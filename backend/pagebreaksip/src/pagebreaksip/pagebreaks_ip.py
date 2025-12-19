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
from pagebreaksip.ast_transforms import PagebreakError, PagebreaksASTTransformer, transformName
from pagebreaksip.equality_check import nested_equal
from pagebreaksip.pagebreak_magic import pagebreak_magics
from pagebreaksip.types import astWalkData
from pandas import DataFrame, Series

# from backend.pagebreak_ip.src.pagebreak_magic import pagebreak_magics
logger.remove()

DEBUG = True
if(DEBUG):
    logger.level("INFO")
    logger.add(sys.stdout)

fmt = "{time} - {name} - {level}"
# logger.add("./pagebreaks/pagebreaks_study.log",watch=True,serialize=True, filter=lambda record: "study" in record["extra"],rotation="50 MB",compression="gz", enqueue=True)
# logger.add("./pagebreaks/pagebreaks_debug.log",watch=True,level="ERROR",retention=3,rotation="50 MB",compression="gz",filter=lambda record: "study" not in record["extra"],enqueue = True)
# study_logger = logger.bind(study=True)


class Pagebreak(object):
    
    def get_user_vars(self) -> dict[str, Any]:
        user_ns = self.shell.user_ns
        user_ns_hidden = self.shell.user_ns_hidden
        nonmatching = object()  # This can never be in user_ns
        user_ns_to_save = {
            name: val
            for name, val in user_ns.items()
            if (not name.startswith("pagebreaks"))
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
        self.current_context: int = 0
        self.magics = None
        self.scopesToExport: dict[int, set[str]] = {}


    def pre_run_cell(self, info: ExecutionInfo):
        logger.info(info.raw_cell)

        #TODO: set default ast data automatically
        # if(info.cell_id == None):
        #     self.ast_transformer.setStoredData(
        #         astWalkData(
        #             currentContext=-1,
        #             userDefinedVariables=set(),  # this will be filled in when we start walking the tree
        #             exportedVariables={},
        #             isLineMagic=True,
        #             namesToIgnore=set()
        #         )
        #     )
        #     return
        
        # Check our magics are setup to get data
        if self.magics is None:
            logger.info("magics error")
            warnings.warn("Pagebreaks Magics Not Found, Please Reload Pagebreaks")
            return
        if self.magics.schema is None:
            warnings.warn("Pagebreaks Schema Not Found, Please Reload Pagebreaks")
            return
        

        schema: dict = self.magics.schema
        logger.info("schema keys" + str(schema.keys()))
        
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
        for key, eachSet in sorted(scopeList.items()):
            for var in eachSet:
                if var in seen:
                    duplicateNames.add(var)
                else:
                    seen.add(var)

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

        #TODO: handle namesToIgnore

        #TODO: enforce that pagebreaks variable can't be messed with by the user

        #find variables we want to export (variables exported by scopes upstream from the current)
        self.scopesToExport = {
            context: val
            for (context, val) in scopeList.items() if context < currentContext
        }

        #find existing state matching pb and add it to main state
        storedStates: dict[int, Any] = self.shell.user_ns.get("pagebreaks",{})
        if(storedStates.get(self.current_context) is not None):
            self.shell.push(storedStates.get(self.current_context))
            logger.info("storedState" + str(storedStates.get(self.current_context)))
        
        #TODO: add closure to returned functions 
        #see PdbClosureBackport


        #add global variables
        logger.info('scopestoexport' + str(self.scopesToExport))
        for scopeNum, names in self.scopesToExport.items():
            state: dict[str, Any] = storedStates.get(scopeNum,{})
            for name in names:
                value = state.get(name)
                logger.info('pushing ' + str(name) + ' with val ' + str(value))
                if isinstance(value, typing.Callable):
                    pass #TODO
                self.shell.push({name : state.get(name)})
        logger.info("state after pre_run" + str(self.get_user_vars()))
        logger.info("pagebreaks after pre_run" + str(self.shell.user_ns.get('pagebreaks',{})))
        # logger.info("scopevalues" + str(scopesToExport.values()))

    def post_run_cell(self, result: ExecutionResult):
        # logger.info("post run")
        #V2:

        logger.info("state post run" + str(self.get_user_vars()))

        if not result.success:
            return
        
        #move user variables back into matching pb 
        storedStates: dict[int, Any] = self.shell.user_ns.get("pagebreaks",{})
        userVars: dict[str, Any] = self.get_user_vars()

        exportVariableNames: list[str] = []
        for scope, variables in self.scopesToExport.items():
            for name in variables:
                exportVariableNames.append(name)
        
        newState:dict[str, Any] = storedStates.get(self.current_context,{})
        if(userVars is not None):
            newState = {name: val for name, val in userVars.items() if name not in exportVariableNames}
            logger.info("newState" + str(newState))

        #TODO: check if module 
        # newState = {key:val for key,val in newState if val}

        #check for any modified variables 
        #TODO: add option for disabling comparison
        namesToDrop = []
        for scope, variables in self.scopesToExport.items():
            storedScope: dict[str, Any] = storedStates.get(scope,{})
            for name in variables:
                localVar = self.shell.user_ns.get(name)
                storedVar = storedScope.get(name, None)
                if localVar is not None:
                    logger.info("calling nested_eq on " + name + str(localVar.__class__))
                    if not nested_equal(localVar,storedVar):
                        namesToDrop.append(name)
                        logger.info(name + "is NOT Equal")

        #clear main state
        for name in userVars:
            self.shell.user_ns.pop(name)

        #if we have any modified exported variables, return to the previous state
        if len(namesToDrop) > 0:

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
             
        #update state store
        storedStates[self.current_context] = newState
        self.shell.push({'pagebreaks' : storedStates})

    def load_metadata(self):
        return

    def set_magics(self, magics: pagebreak_magics):
        self.magics = magics

    

_pb: Pagebreak | None = None

def load_ipython_extension(ip: TerminalInteractiveShell):
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
        # ip.ast_transformers.remove(_pb.ast_transformer)
        ip.events.unregister("pre_run_cell", _pb.pre_run_cell)
        ip.events.unregister("post_run_cell", _pb.post_run_cell)
    else:
        logger.debug("extension is NULL")

