import ast
import copy
import itertools
import os
import re
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
from pandas import DataFrame, Series

# from backend.pagebreak_ip.src.pagebreak_magic import pagebreak_magics

DEBUG = False
# def serialize(record):
#     subset = {
#         # "timestamp": datetime.datetime.utcnow().isoformat(),
#         # "src_name": os.environ.get('SOURCE_NAME', ''),
#         # "workload_name": os.environ.get('WORKLOAD_NAME', ''),
#         # "hostname":  os.environ.get('HOSTNAME', ''),
#         # "automaton_profile": os.environ.get('AUTOMATON_PROFILE', ''),
#         # "automaton_name": os.environ.get('AUTOMATON_NAME', ''),
#         # "message": record["message"],
#         # "data": record["extra"],
#     }
#     return json.dumps(subset)


# def patching(record):
#     record["extra"]["serialized"] = serialize(record)


logger.remove() #to remove std 

# logger = logger.patch(patching)

fmt = "{time} - {name} - {level}"
logger.add("./pagebreaks/pagebreaks_study.log",watch=True,serialize=True, filter=lambda record: "study" in record["extra"],rotation="50 MB",compression="gz", enqueue=True)
logger.add("./pagebreaks/pagebreaks_debug.log",watch=True,level="ERROR",retention=3,rotation="50 MB",compression="gz",filter=lambda record: "study" not in record["extra"],enqueue = True)
study_logger = logger.bind(study=True)
# logger.add()
# logger = logging.getLogger("pagebreaks")
# study_logger = logging.getLogger("pagebreaks_study")
# class NameAdder(ast.NodeTransformer):

#     def __init__(self):
#         self.namesFound = []


#     def visit_Name(self, node: ast.Name):
#         self.namesFound.append(node.id)
#         return node
@dataclass
class astWalkData:
    currentContext: int
    userDefinedVariables: set[str]  # the variables we've defined so far in this scope
    exportedVariables: dict[int, set[str]]  # the variables exported from each scope
    isLineMagic: bool
    namesToIgnore: set[str]


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
        if DEBUG:
            print(dump)
        self.currentExportSet.clear()  # wipe the export set every run
        self.newlyAddedExportedVariables[1].clear() # wipe added variables every run
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
        if DEBUG:
            dump = ast.dump(node, indent=4)
            print(dump)
        return node

    def visit_Name(self, node, data: astWalkData):
        if not data.isLineMagic:
            logger.info("visit name export variables" + str(data.exportedVariables))
        if node.id in data.namesToIgnore:
            print("ignoring name " + node.id)
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

    def visit_FunctionDef(self, node, data: astWalkData):
        return self.handleNewBlock(node, data)

    def visit_ClassDef(self, node: ast.ClassDef, data: astWalkData):
        return self.handleNewBlock(node, data)

    def handleNewBlock(self, node, data: astWalkData):
        if node.name in data.userDefinedVariables:
            node.name = transformName(node.name, data.currentContext)
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

        data.userDefinedVariables.difference_update(newDefinitions)

        self.generic_visit(node, data)
        return node
    
    def revertNewlyAddedNames(self):
        context = self.newlyAddedExportedVariables[0]
        namesToRemove = self.newlyAddedExportedVariables[1]
        currentNames = self.userVariables.get(context, set())
        currentNames.difference_update(namesToRemove)
        self.userVariables.update({context :currentNames})



class Pagebreak(object):

    def get_user_vars(self, shell, context: int, parameter_s=""):
        user_ns = shell.user_ns
        user_ns_hidden = shell.user_ns_hidden
        nonmatching = object()  # This can never be in user_ns
        user_ns_to_save = {
            name: val
            for name, val in user_ns.items()
            if name.startswith("pb_" + str(context) + "_")
            and (user_ns[name] != user_ns_hidden.get(name, nonmatching))
        }

        # typelist = parameter_s.split()
        # if typelist:
        #     typeset = set(typelist)
        #     out = [i for i in out if type(user_ns[i]).__name__ in typeset]

        # out.sort()
        return user_ns_to_save

    def __init__(self, ip: TerminalInteractiveShell):
        self.shell = ip
        self.ast_transformer = PagebreaksASTTransformer(ip)
        self.shell.ast_transformers.append(self.ast_transformer)
        self.current_context: int = 0
        self.magics = None
        self.cache: dict[str, Any] = {}
        # self.exportedVariables: dict[int, set[str]] = {}
        self.exportVariableNames: dict[str, str] = {}


    def pre_run_cell(self, info: ExecutionInfo):
        logger.info(info.raw_cell)
        # info_dict = {'id': info.cell_id, 'raw_cell': info.raw_cell}
        # study_logger.info("Run Cell:" + str(info_dict) )

        if(info.cell_id == None):
            self.ast_transformer.setStoredData(
                astWalkData(
                    currentContext=-1,
                    userDefinedVariables=set(),  # this will be filled in when we start walking the tree
                    exportedVariables={},
                    isLineMagic=True,
                    namesToIgnore=set()
                )
            )
            return
        # Check our magics are setup to get data
        if self.magics is None:
            logger.info("magics error")
            warnings.warn("Magics Error, Please Reload Pagebreaks")
            return
        if self.magics.schema is None:
            warnings.warn("Schema Error, Please Reload Pagebreaks")
            return
        

        # grab our data structure from the front end
        schema: dict = self.magics.schema
        # if DEBUG:
        #     pprint.pprint(schema.keys())
        if schema.get('inactive',False):
            logger.info("Pagebreaks is inactive")
            self.ast_transformer.setStoredData(
                astWalkData(
                    currentContext=-1,
                    userDefinedVariables=set(),  # this will be filled in when we start walking the tree
                    exportedVariables={},
                    isLineMagic=True,
                    namesToIgnore=set()
                )
            )
            return
        
        cellsToScopes: dict[str, int] = schema.get("cellsToScopes", {})
        scopeList: dict[int, set[str]] = {
            int(key): set(val)
            for (key, val) in schema.get("scopeList", {}).items()
        }

        # check if our cell_id is in a scope
        currentContext: int = cellsToScopes.get(str(info.cell_id), -1)
        if currentContext == -1:
            raise PagebreakError("Couldn't find schema, please reload the page").with_traceback(None)
        self.current_context = currentContext

        # check for duplicate exported names and previous exports which aren't defined
        # (we don't want to export a variable if it shares the name with a previously exported one, 
        # or if it doesn't exist yet)
        duplicateNames = set()
        seen = set()
        cleanedScopeList: dict[int, set[str]] = {}
        for key, eachSet in sorted(scopeList.items()):
            for var in eachSet:
                if var in seen:
                    duplicateNames.add(var)
                else:
                    seen.add(var)
                    searchName = transformName(var, key, False)
                    # print("searching for", searchName)
                    if (searchName in self.shell.user_ns.keys()) or (key >= self.current_context):
                        # print("adding variable to export", var, "in scope", key)
                        if cleanedScopeList.get(key) is not None:
                            cleanedScopeList[key].add(var)
                        else:
                            cleanedScopeList[key] = set([var])

        # If we have any duplicate names found, warn the user
        if len(duplicateNames) > 0:
            # logger.info("duplicateNames", duplicateNames)
            warnings.warn(
                "(Pagebreaks) Duplicate Exported Variables: '"
                + " ,".join(duplicateNames)
                + "', skipping later exports"
            )

        # Check for ignore_names pragma
        cell = typing.cast(str,info.raw_cell)
        pragmaSearch = re.compile(r"""#pagebreaks: ignore_name (\S*)""")
        ignoreMatches = pragmaSearch.findall(cell)
        namesToIgnore:set[str] = set()
        for match in ignoreMatches:
            strmatch = typing.cast(str,match)
            if len(namesToIgnore) == 0:
                namesToIgnore = set([strmatch])
            else:
                namesToIgnore.add(strmatch)
        #Set our data within the AST Transformer, which fires after we return from this function
        self.ast_transformer.setStoredData(
            astWalkData(
                currentContext=currentContext,
                userDefinedVariables=set(),  # this will be filled in when we start walking the tree
                exportedVariables=cleanedScopeList,
                isLineMagic=False,
                namesToIgnore=namesToIgnore
            )
        )
        logger.info("setting data:" + str(cleanedScopeList) + "current context" + str(currentContext))
        # if DEBUG:
        #     print("cleaned ScopeList ", cleanedScopeList)
        #     print("current Context", currentContext)


        # cache local variables
        cache = {
            name: value
            for (name, value) in self.shell.user_ns.items()
            if name.startswith("pb_" + str(currentContext) + "_")
        }
        self.cache = cache


        #find variables we want to export (variables exported by scopes upstream from the current)
        scopesToExport: dict[int, set[str]] = {
            context: val
            for (context, val) in cleanedScopeList.items()
            if context < currentContext
        }

        # Format Variable Names (find the local "pb_x_var" name and the global "pb_export_var" name)
        exportVariableNames: dict[str, str] = {}
        for scope, variables in scopesToExport.items():
            for name in variables:
                localName = transformName(name, scope, False)
                globalName = transformName(name, scope, True)
                exportVariableNames[localName] = globalName
        logger.info("exportvariablenames" + str(exportVariableNames))

        # Clear Previously Exported Variables if we aren't actively exporting them now 
        # (i.e. they were removed from the list, or we switched contexts)
        globalNamesToDelete = [
            name
            for name in self.shell.user_ns
            if name.startswith("pb_export_")
            & (name not in exportVariableNames.values())
        ]
        if len(globalNamesToDelete) > 0:
            logger.info("deleting" + str(globalNamesToDelete))
            for name in globalNamesToDelete:
                self.shell.user_ns.pop(name, None)

        # Make Global Copies of Local Vars (actually export the variables)
        exportVariables = {}
        for localName, globalName in exportVariableNames.items():
            localValue = self.shell.user_ns.get(localName, None)
            if localValue is not None:
                exportVariables[globalName] = copy.deepcopy(localValue)
        # logger.info("push export variables" + str(exportVariables))
        # if DEBUG:
        #     print("exporting variables:",exportVariables)
        self.shell.push(exportVariables)
        self.exportVariableNames = exportVariableNames

    def post_run_cell(self, result: ExecutionResult):
        # logger.info("post run")
        info = typing.cast(ExecutionInfo, result.info)
        info_dict = {'id':info.cell_id, 'result': result.error_in_exec, 'raw_cell':info.raw_cell ,'success': result.success, 'raw_cell': info.raw_cell}
        study_logger.info("Run Cell:" + str(info_dict) )
        if not result.success:
            #Restore Cached Variables on fail
            self.shell.user_ns.update(self.cache)

            #Delete new definitions
            self.ast_transformer.revertNewlyAddedNames()
            return
        
        # Check whether any exported variables have been modified
        # this gets tricky with classes, but is straightforward with most other variables
        namesToDrop = []
        for localName, globalName in self.exportVariableNames.items():
            localVar = self.shell.user_ns.get(localName)
            globalVar = self.shell.user_ns.get(globalName)
            if localVar is not None:
                logger.info("calling nested_eq on " + localName + str(localVar.__class__))
                isEqual = self.nested_equal(localVar,globalVar)
                logger.info("isEqual:" + str(isEqual))
                if not isEqual:
                   namesToDrop.append(globalName)
                # #if the variable has a dict, it means its a class instantiation
                # if hasattr(localVar, "__dict__"):
                #     # if the type of the variable has changed, we know its been modified
                #     if type(localVar) != type(globalVar):
                #         namesToDrop.append(globalName)
                #     # otherwise, we compare the dicts of the two to compare their state
                #     elif hasattr(globalVar, "__dict__"):
                #         if localVar.__dict__ != globalVar.__dict__:
                #             namesToDrop.append(globalName)
                # # Otherwise, this is a normal comparison by value
                # else:
                #     if localVar != globalVar:
                #         logger.info("found unequal variable" + localName + globalName)
                #         namesToDrop.append(globalName)


        #if we have any modified exported variables, return to the previous state
        if len(namesToDrop) > 0:
            for name in namesToDrop:
                self.shell.user_ns.pop(name)

            # ## reset local variables
            # localVariableNames = [
            #     name
            #     for name in self.shell.user_ns.keys()
            #     if name.startswith("pb_" + str(self.current_context) + "_")
            # ]
            # for name in localVariableNames:
            #     self.shell.user_ns.pop(name)

            ## reset local variables
            self.shell.user_ns.update(self.cache)

            #Delete new definitions
            self.ast_transformer.revertNewlyAddedNames()

            ## Throw Pretty Error Message
            try:
                userFacingNames = [
                    name.removeprefix("pb_export_") for name in namesToDrop
                ]
                logger.error("Attempted to Overwrite Read-Only Exported Variables: " + str(namesToDrop))
                raise PagebreakError(
                    "Attempted to Overwrite Read-Only Exported Variables: '"
                    + ", ".join(userFacingNames)
                    + "'",
                    "",
                ).with_traceback(None)
            except:
                self.shell.showtraceback()

    def load_metadata(self):
        return

    def set_magics(self, magics: pagebreak_magics):
        self.magics = magics

    def nested_equal(self, localVar, globalVar) -> bool:
        if localVar.__class__ != globalVar.__class__:
            logger.info("classes dont match")
            return False
        # for types that implement their own custom strict equality checking
        seq = getattr(localVar, "seq", None)
        if seq and callable(seq):
            logger.info("seq" + str(seq(globalVar)))
            return seq(globalVar)
        #     # Check equality according to type type [sic].
        # if isinstance(localVar, basestring):
        #     return localVar == globalVar

        if isinstance(localVar, np.ndarray):
            logger.info("ndarray" + str(bool(np.all(localVar == globalVar))))
            return bool(np.all(localVar == globalVar))
        if isinstance(localVar, Sequence):
            isEqual = all(itertools.starmap(eq, zip(localVar, globalVar)))
            logger.info("Sequence" + str(isEqual))
            return isEqual
            # return all(self.nested_equal(x, y) for x, y in zip(localVar, globalVar))
        if isinstance(localVar, Mapping):
            if set(localVar.keys()) != set(globalVar.keys()):
                return False
            return all(self.nested_equal(localVar[k], globalVar[k]) for k in localVar.keys())
        if isinstance(localVar, Set):
            return localVar == globalVar
        if isinstance(localVar, Series):
            return localVar.equals(globalVar)
        if isinstance(localVar, DataFrame):
            return localVar.equals(globalVar)
        if hasattr(localVar, "__dict__") and hasattr(globalVar, "__dict__"):
            logger.info("comparing __dict__s")
            for localVal, globalVal in zip(localVar.__dict__,globalVar.__dict__):
                if not self.nested_equal(localVal,globalVal):
                    logger.info("dicts dont match")
                    logger.info(str(localVar.__dict__))
                    logger.info(str(globalVar.__dict__))
                    return False
        isEqual = (localVar == globalVar)
        if isinstance(isEqual,Iterable):
            return all(isEqual)
        if isinstance(isEqual, bool):
            return isEqual
        logger.error("nested equal returned something weird" + str(isEqual.__class__)+ str(isEqual))
        #https://stackoverflow.com/questions/18376935/best-practice-for-equality-in-python
#         from collections import Sequence, Mapping, Set
# import numpy as np

# def nested_equal(a, b):
#     """
#     Compare two objects recursively by element, handling numpy objects.

#     Assumes hashable items are not mutable in a way that affects equality.
#     """
#     # Use __class__ instead of type() to be compatible with instances of 
#     # old-style classes.
    # if a.__class__ != b.__class__:
    #     return False

#     # for types that implement their own custom strict equality checking
#     seq = getattr(a, "seq", None)
#     if seq and callable(seq):
#         return seq(b)

#     # Check equality according to type type [sic].
#     if isinstance(a, basestring):
#         return a == b
#     if isinstance(a, np.ndarray):
#         return np.all(a == b)
#     if isinstance(a, Sequence):
#         return all(nested_equal(x, y) for x, y in zip(a, b))
#     if isinstance(a, Mapping):
#         if set(a.keys()) != set(b.keys()):
#             return False
#         return all(nested_equal(a[k], b[k]) for k in a.keys())
#     if isinstance(a, Set):
#         return a == b
#     return a == b
        return False

_pb: Pagebreak | None = None
_pb_magics: pagebreak_magics | None = None


def load_ipython_extension(ip: TerminalInteractiveShell):
    os.makedirs(os.path.dirname("./.pagebreaks/pagebreaks.log"), exist_ok=True)
    # logging.basicConfig(filename="pagebreaks.log", level=logging.INFO)
    

    # study_handler = logging.handlers.RotatingFileHandler('./.pagebreaks/pagebreaks_study.log',maxBytes=50000000,backupCount=100000)
    # study_handler.level = logging.INFO
    # study_logger.addHandler(study_handler)
    # handler = logging.FileHandler("pagebreak_debug.log")
    # handler.level = logging.INFO
    # logging.getLogger("pagebreaks").addHandler(handler)
   

    global _pb
    _pb = Pagebreak(ip)
    ip.run_line_magic("lsmagic", "")
    existing_pb_magic = ip.find_magic("%pb_update", "line")
    if existing_pb_magic is None:
        _pb_magics = pagebreak_magics(ip,_pb)
        ip.register_magics(_pb_magics)
        _pb.set_magics(_pb_magics)
    else:
        _pb.set_magics(existing_pb_magic)
    ip.events.register("pre_run_cell", _pb.pre_run_cell)
    ip.events.register("post_run_cell", _pb.post_run_cell)


def unload_ipython_extension(ip: TerminalInteractiveShell):
    global _pb
    if _pb:
        ip.ast_transformers.remove(_pb.ast_transformer)
        ip.events.unregister("pre_run_cell", _pb.pre_run_cell)
        ip.events.unregister("post_run_cell", _pb.post_run_cell)
    else:
        print("extension is NULL")


# try:
#     unload_ipython_extension(get_ipython())
# except Exception:
#     pass
# finally:
