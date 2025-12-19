import ast
import copy
import itertools
import os
import re
import sys
import typing
import warnings
from collections import Counter
from collections.abc import Iterable, Iterator, Mapping, Sequence
from dataclasses import dataclass
from operator import eq
from typing import Any, Dict, List, Set, Tuple, Type

import numpy as np
from IPython.core.error import InputRejected, UsageError
from IPython.core.interactiveshell import ExecutionInfo, ExecutionResult
from IPython.terminal.interactiveshell import TerminalInteractiveShell
from loguru import logger
from pagebreaksip.pagebreak_magic import pagebreak_magics
from pagebreaksip.types import astWalkData
from pandas import DataFrame, Series




def transformName(name: str, context: int, export: bool = False):
    if export:
        return "pb_export_" + name
    else:
        return "pb_" + str(context) + "_" + name


class baseASTTransform(ast.NodeTransformer):

    def __init__(self):
        self.storedData = None

    def setStoredData(self, data: astWalkData):
        self.storedData = data

    def getStoredData(self):
        return self.storedData

    def visit(self, node, data=None):
        if data == None:  # top level call
            data = self.storedData
        method = "visit_" + node.__class__.__name__
        visitor = getattr(self, method, self.generic_visit)
        # logger.info("visit data:", data)
        return visitor(node, copy.deepcopy(data))

    def generic_visit(self, node, data):
        for field, old_value in ast.iter_fields(node):
            if isinstance(old_value, list):
                new_values = []
                for value in old_value:
                    if isinstance(value, ast.AST):
                        value = self.visit(value, data)
                        if value is None:
                            continue
                        elif not isinstance(value, ast.AST):
                            new_values.extend(value)
                            continue
                    new_values.append(value)
                old_value[:] = new_values
            elif isinstance(old_value, ast.AST):
                new_node = self.visit(old_value, data)
                if new_node is None:
                    delattr(node, field)
                else:
                    setattr(node, field, new_node)
        return node

    # from https://github.com/python/cpython/blob/3.12/Lib/ast.py#L633
    _const_node_type_names = {
        bool: "NameConstant",  # should be before int
        type(None): "NameConstant",
        int: "Num",
        float: "Num",
        complex: "Num",
        str: "Str",
        bytes: "Bytes",
        type(...): "Ellipsis",
    }

    def visit_Constant(self, node, data):
        value = node.value
        type_name = self._const_node_type_names.get(type(value))
        if type_name is None:
            for cls, name in self._const_node_type_names.items():
                if isinstance(value, cls):
                    type_name = name
                    break
        if type_name is not None:
            method = "visit_" + type_name
            try:
                visitor = getattr(self, method)
            except AttributeError:
                pass
            else:
                import warnings

                warnings.warn(
                    f"{method} is deprecated; add visit_Constant", DeprecationWarning, 2
                )
                return visitor(node, data)
        return self.generic_visit(node, data)


class DefinitionsFinder(baseASTTransform):

    def __init__(self):
        self.trackedNames: set[str] = set()
        self.globalKeywords: set[str] = set()
        self.nonlocalKeywords: set[str] = set()
        self.storedData = None

    # def visit_Assign(self, node: ast.Assign, data=None):
    #     nameAdder = NameAdder()
    #     for tar in node.targets:
    #         nameAdder.visit(tar)
    #     self.trackedNames.update(set(nameAdder.namesFound))
    #     return node

    def visit_ClassDef(self, node: ast.ClassDef, data=None):
        self.trackedNames.add(node.name)
        return node

    def visit_FunctionDef(self, node: ast.FunctionDef, data=None):
        self.trackedNames.add(node.name)
        return node

    def visit_Global(self, node: ast.Global, data=None):
        for tar in node.names:
            self.globalKeywords.add(tar)
        logger.info("added globals" + str(self.globalKeywords))
        return node

    def visit_Nonlocal(self, node: ast.Nonlocal, data=None):
        for tar in node.names:
            self.nonlocalKeywords.add(tar)
        logger.info("added nonlocals" + str(self.nonlocalKeywords))
        return node

    def getDefinitionsAtNode(self, node) -> set[str]:
        self.generic_visit(node, None)
        self.trackedNames.difference_update(self.globalKeywords)
        self.trackedNames.difference_update(self.nonlocalKeywords)
        return self.trackedNames

    def visit_Name(self, node: ast.Name, data=None):
        if isinstance(node.ctx, ast.Store):
            self.trackedNames.add(str(node.id))
        return node


class PagebreakError(SyntaxError):
    def __init__(self, message, errors=""):
        self.message = message
        super().__init__(message)
        super().with_traceback(None)
        self.errors = errors

    def __str__(self) -> str:
        return self.message

    def __repr__(self) -> str:
        return self.message


class PagebreaksASTTransformer(baseASTTransform):

    def __init__(self, shell=None):
        self.shell: TerminalInteractiveShell | None = shell
        super().__init__()

        # variables we've defined so far in each pagebreak
        self.userVariables: dict[int, set[str]] = ({})  

        # for each exported variable, we store the pair of their local name and their global name
        self.currentExportSet: set[Tuple[str, str]] = (set())  

        # if the cell errors, we need to remove the newly added definitions, so we store them here
        self.newlyAddedExportedVariables : tuple[int, set[str]] = (0,set())
        
    def setStoredData(self, data: astWalkData):
        super().setStoredData(data)

    def getStoredData(self):
        return super().getStoredData()

    # always called first as the top level AST node, we're going to walk the tree and find
    # all the global definitions with a separate transformer, "variableFinder"
    def visit_Module(self, node: ast.Module, data: astWalkData):
        # if not hasattr(node, "_attributes"):
        #     node._attributes = ("",)
        if data is None:
            warnings.warn(
                "ABORTING: Have not yet connected to Jupyter Extension, is it installed?"
            )
            return node
        
        ## running from Ipython REPL, not Jupyter OR plugin is set to inactive
        if data.currentContext == -1:
            return node
        
        # if node is None:
        #     print("node is none")
        #     logger.info("Node is none" + str(data))
        #     return node
        dump = ast.dump(node, indent=4)
        if "pb_update" in dump:
            return node
        if "attr='run_line_magic'" in dump:
            specialMagics = ["Constant(value='store')"]
            if any(magic in dump for magic in specialMagics):
                data.isLineMagic = True
                # print("found line magic")
        if "extension_manager" in dump:
            data.isLineMagic = True

        if "extension_manager" not in dump:
            logger.info("Module Start:" +  str(data.currentContext) + str(data.exportedVariables))
            logger.info("Pretransformed AST: " + str(dump))

        logger.info(dump)
        self.currentExportSet.clear()  # wipe the export set every run
        self.newlyAddedExportedVariables = (0, set()) # wipe added variables every run
        defFinder = DefinitionsFinder()
        trackedNames = defFinder.getDefinitionsAtNode(node)

        if not data.isLineMagic:
            logger.info("New Definitions Found:" + str(trackedNames))
            logger.info(trackedNames)

        savedVariables = self.userVariables.get(data.currentContext, set())
        savedVariables.update(trackedNames)
        # savedVariables.difference_update(data.namesToIgnore)
        self.userVariables.update({data.currentContext: savedVariables})
        self.newlyAddedExportedVariables = (data.currentContext, trackedNames)
        
        if not data.isLineMagic:
            logger.info("saved variables" + str(self.userVariables))

        data.userDefinedVariables.update(savedVariables)
        self.generic_visit(node, data)
        if not data.isLineMagic:
            logger.info("Transformed AST" + str(dump))
        dump = ast.dump(node, indent=4)
        logger.info(dump)
        logger.info("user defined variables" + str(data.userDefinedVariables))
        logger.info("names to ignore" + str(data.namesToIgnore))
        logger.info("exported variables" + str(data.exportedVariables))
        return node

    def visit_Name(self, node, data: astWalkData):
        if not data.isLineMagic:
            logger.info("visit name"+ ast.dump(node)+"data")
            logger.info(data)
        if node.id in data.namesToIgnore:
            logger.info("ignoring name " + node.id)
            return node
        # check if variable is exported from another context
        for context, exportedVariables in data.exportedVariables.items():
            if (
                node.id in exportedVariables
                and context < data.currentContext  # only export variables from earlier contexts
            ):
                if not data.isLineMagic:
                    logger.info(
                    "changing name ["
                    + node.id
                    + "] to ["
                    + transformName(node.id, context)
                    + "]"
                )
                if isinstance(
                    node.ctx, ast.Store
                ):  # we can only statically check for re-assignments of exported variables. On plug-in itself we'll dynamically check for exported variables changing.
                    logger.error("Variable redefinition" + node.id)
                    message = (
                        """Pagebreaks Error: Attempted to Redefine Exported Variable: '"""
                        + str(node.id)
                        + """' elsewhere in the notebook"""
                    )
                    if self.shell is None:
                        raise InputRejected(message)

                    shell = typing.cast(TerminalInteractiveShell, self.shell)
                    er = InputRejected(message).with_traceback(None)
                    setattr(
                        er,
                        "_render_traceback_",
                        lambda: shell.InteractiveTB.get_exception_only(
                            type(er), message
                        ),
                    )
                    raise er
                return ast.Name(
                    id=transformName(node.id, context, export=True), ctx=node.ctx
                )
        if node.id in data.userDefinedVariables:
            if not data.isLineMagic:
                logger.info(
                "changing name ["
                + node.id
                + "] to ["
                + transformName(node.id, data.currentContext)
                + "]"
            )
            return ast.Name(
                id=transformName(node.id, data.currentContext), ctx=node.ctx
            )

        return node
    def visit_Constant(self, node, data: astWalkData):
        # if node.value in data.userDefinedVariables:
        #     return ast.Constant(value=transformName(node.value,data.currentContext))
        # self.generic_visit(node, data)
        return node

    # we dont want to touch anything in import statements
    def visit_Import(self, node, data: astWalkData):
        return node

    def visit_Global(self, node: ast.Global, data: astWalkData):
        def transName(name):
            if name in data.userDefinedVariables:
                return transformName(name, data.currentContext)
            else:
                return name

        newNames = list(map(transName, node.names))
        return ast.Global(names=newNames)

    def visit_FunctionDef(self, node: ast.FunctionDef, data: astWalkData):
        
        return self.handleNewBlock(node, data)

    def visit_ClassDef(self, node: ast.ClassDef, data: astWalkData):
        return self.handleNewBlock(node, data)

    def handleNewBlock(self, node, data: astWalkData):
        
        defFinder = DefinitionsFinder()
        newDefinitions = defFinder.getDefinitionsAtNode(node)
        # check if any defs are overwriting exported variables
        logger.info(
            "HandleNewBlock:" + str(node) + ", with definitions: " + str(newDefinitions)
        )

        # we can just remove any variable names which are redefined because python considers any definition local 
        # to a block by default, so we need a special case for the "global" and "nonlocal" keywords, but otherwise
        # if a definition occurs within a block, its assumed other references to that varible in that block 
        # reference the local var, so a global variable can't be used and a local variable of the same name cant 
        # be defined in the same python block, regardless of where that definition is in the block. For example, this:
        # a = 1
        # def f():
        #     a = a + 1
        # f()
        # will throw an error for this reason

        # need to remove function arguements
        if isinstance(node,ast.FunctionDef):
            node.args.defaults = [self.visit(default, data) for default in node.args.defaults]
            node.args.kw_defaults = [self.visit(default, data) for default in node.args.kw_defaults]
            node = typing.cast(ast.FunctionDef,node)
            arguments = set()
            for arg in node.args.args:
                if len(arguments) == 0:
                    arguments = set([arg.arg])
                else:
                    arguments.add(arg.arg)
            for arg in node.args.kwonlyargs:
                if len(arguments) == 0:
                    arguments = set([arg.arg])
                else:
                    arguments.add(arg.arg)
            for arg in node.args.posonlyargs:
                if len(arguments) == 0:
                    arguments = set([arg.arg])
                else:
                    arguments.add(arg.arg)
            if node.args.kwarg is not None:
                if len(arguments) == 0:
                    arguments = set([node.args.kwarg.arg])
                else:
                    arguments.add(node.args.kwarg.arg)
            if node.args.vararg is not None:
                if len(arguments) == 0:
                    arguments = set([node.args.vararg.arg])
                else:
                    arguments.add(node.args.vararg.arg)


            data.namesToIgnore.update(arguments)
        data.userDefinedVariables.difference_update(newDefinitions)
        data.namesToIgnore.update(newDefinitions)
        self.generic_visit(node, data)
        if node.name in data.namesToIgnore:
            return node
        for context, exportedVariables in data.exportedVariables.items():
            if (
                node.name in exportedVariables
                and context < data.currentContext  # only export variables from earlier contexts
            ):
                node.name = transformName(node.name, data.currentContext, export=True)
                return node
        if node.name in data.userDefinedVariables:
            node.name = transformName(node.name, data.currentContext)
        return node
        
    
    def revertNewlyAddedNames(self):
        context = self.newlyAddedExportedVariables[0]
        namesToRemove = self.newlyAddedExportedVariables[1]
        currentNames = self.userVariables.get(context, set())
        currentNames.difference_update(namesToRemove)
        self.userVariables.update({context :currentNames})