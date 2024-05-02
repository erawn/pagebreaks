import ast
from dataclasses import dataclass
import copy
from typing import List, Tuple, Set, Dict, Type
from IPython.core.error import InputRejected
from IPython.testing.globalipapp import start_ipython
from IPython.terminal.interactiveshell import TerminalInteractiveShell
from IPython.core.interactiveshell import ExecutionResult, ExecutionInfo
from pagebreak_magic import pagebreak_magics

DEBUG = True


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
        # print("visit data:", data)
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
        print("added globals", self.globalKeywords)
        return node

    def visit_Nonlocal(self, node: ast.Nonlocal, data=None):
        for tar in node.names:
            self.nonlocalKeywords.add(tar)
        print("added nonlocals", self.nonlocalKeywords)
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


class PagebreakError(RuntimeError):
    def __init__(self, message, errors):
        super().__init__(message)
        self.errors = errors
        print(errors)


class PagebreaksASTTransformer(baseASTTransform):

    def __init__(self):
        super().__init__()
        self.userVariables: dict[int, set[str]] = (
            {}
        )  # variables we've defined so far in each pagebreak
        self.currentExportSet: set[Tuple[str, str]] = (
            set()
        )  # for each exported variable, we store the pair of their local name and their global name

    def setStoredData(self, data: astWalkData):
        super().setStoredData(data)

    def getStoredData(self):
        return super().getStoredData()

    # always called first as the top level AST node, we're going to walk the tree and find
    # all the global definitions with a separate transformer, "variableFinder"
    def visit_Module(self, node: ast.Module, data: astWalkData):
        if data is None:
            print(
                "ABORTING: Have not yet connected to Jupyter Extension, is it installed?"
            )
            return node
        self.currentExportSet.clear()  # wipe the export set every run
        defFinder = DefinitionsFinder()
        trackedNames = defFinder.getDefinitionsAtNode(node)
        # if DEBUG:
        #     if (len(trackedNames)) > 0:
        #         print("New Definitions Found:")
        #         print(trackedNames)
        # dump = ast.dump(node, indent=4)
        # print(dump)
        savedVariables = self.userVariables.get(data.currentContext, set())
        savedVariables.update(trackedNames)
        print("saved variables", savedVariables)
        data.userDefinedVariables.update(savedVariables)
        self.generic_visit(node, data)
        return node

    def visit_Name(self, node, data: astWalkData):
        # check if variable is exported from another context
        for context in data.exportedVariables.keys():
            if (
                context != data.currentContext
                and node.id in data.exportedVariables.get(context, set())
                and context
                < data.currentContext  # only export variables from earlier contexts
            ):
                print("here")
                # if DEBUG:
                #     print(
                #         "changing name ["
                #         + node.id
                #         + "] to ["
                #         + self.transformName(node.id, context)
                #         + "]"
                #     )
                if isinstance(
                    node.ctx, ast.Store
                ):  # we can only statically check for re-assignments of exported variables. On plug-in itself we'll dynamically check for exported variables changing.
                    raise InputRejected(
                        """PagebreaksError: Attempted to Redefine Exported Variable: '"""
                        + str(node.id)
                        + """' elsewhere in the notebook"""
                    )  # the only kind of error we can raise, otherwise IPython will disable the transformer
                return ast.Name(
                    id=transformName(node.id, context, export=True), ctx=node.ctx
                )
        if node.id in data.userDefinedVariables:
            if DEBUG:
                print(
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
        if DEBUG:
            print("found defs at:", node, ", with definitions: ", newDefinitions)

        # we can just remove any variable names which are redefined because python considers any definition local to a block by default, so we need a special case for the "global" and "nonlocal" keywords, but otherwise if a definition occurs within a block, its assumed other references to that varible in that block reference the local var, so a global variable can't be used and a local variable of the same name cant be defined in the same python block, regardless of where that definition is in the block. For example, this:
        # a = 1
        # def f():
        #     a = a + 1
        # f()
        # will throw an error for this reason
        data.userDefinedVariables.difference_update(newDefinitions)

        self.generic_visit(node, data)
        return node


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
        self.ast_transformer = PagebreaksASTTransformer()
        self.shell.ast_transformers.append(self.ast_transformer)
        self.current_context: int = 0
        self.magics = None
        self.exportedVariables: dict[int, set[str]] = {}

    def set_current_context(self, newcontext: int):
        print("setting current context to:", newcontext)
        self.current_context = newcontext
        self.ast_transformer.currentContext = newcontext

    def pre_run_cell(self, info: ExecutionInfo):
        # print("pre run")
        # temporary: change contexts with simple pragma
        # first_line = info.raw_cell.partition("\n")[0]
        # if first_line.startswith("#changeContexts"):
        #     arg = first_line.partition(" ")[2]
        #     if DEBUG:
        #         print("Setting context to :[" + arg + "]")
        #     self.set_current_context(int(arg))
        # self.shell.meta["pagebreak"] = "this is a test"
        # print(info)
        # set the current context
        if self.magics is None:
            if self.magics.schema is None:
                print("magics error")
                return

        schema: dict = self.magics.schema

        cellsToScopes: dict[str, int] = schema.get("cellsToScopes", {})
        scopeList: dict[int, set[str]] = {
            int(key): set(val) for (key, val) in schema.get("scopeList", {}).items()
        }
        currentContext: int = cellsToScopes[info.cell_id]
        self.ast_transformer.setStoredData(
            astWalkData(
                currentContext=currentContext,
                userDefinedVariables=set(),  # this will be filled in when we start walking the tree
                exportedVariables=scopeList,
            )
        )
        print("setting data:", self.ast_transformer.getStoredData())
        self.set_current_context(cellsToScopes[info.cell_id])
        # cache exported variables

        scopesToExport: dict[int, set[str]] = {
            context: val
            for (context, val) in scopeList.items()
            if context < currentContext
        }
        exportVariableNames: dict[str, str] = {}
        for scope, variables in scopesToExport.items():
            for name in variables:
                localName = transformName(name, scope, False)
                globalName = transformName(name, scope, True)
                exportVariableNames[localName] = globalName
        exportVariables = {}
        for localName, globalName in exportVariableNames.items():
            exportVariables[globalName] = copy.deepcopy(
                self.shell.user_ns.get(localName)
            )
        # print("push export variables", exportVariables)
        self.shell.push(exportVariables)

    def post_run_cell(self, result: ExecutionResult):
        # print("post run")
        if result.success:
            currentExportSet = self.ast_transformer.currentExportSet
            namesToDrop = []
            for localName, globalName in currentExportSet:
                if self.shell.user_ns.get(localName) != self.shell.user_ns.get(
                    globalName
                ):
                    # revert state here
                    namesToDrop.append(globalName)

            if len(namesToDrop) > 0:
                self.shell.drop_by_id(namesToDrop)
                raise PagebreakError(
                    "Attempted to Overwrite Read-Only Exported Variables: '"
                    + ", ".join(namesToDrop)
                    + "'",
                    "",
                )

    def load_metadata(self):
        return

    def set_magics(self, magics: pagebreak_magics):
        self.magics = magics


_pb: Pagebreak | None = None
_pb_magics: pagebreak_magics | None = None


def load_ipython_extension(ip: TerminalInteractiveShell):
    _pb_magics = pagebreak_magics(ip)
    _pb = Pagebreak(ip)
    _pb.set_magics(_pb_magics)
    ip.events.register("pre_run_cell", _pb.pre_run_cell)
    ip.events.register("post_run_cell", _pb.post_run_cell)
    ip.register_magics(_pb_magics)


def unload_ipython_extension(ip: TerminalInteractiveShell):
    if _pb is not None:
        ip.events.unregister("pre_run_cell", _pb.pre_run_cell)  # type: ignore
        ip.events.unregister("post_run_cell", _pb.post_run_cell)  # type: ignore


# try:
#     unload_ipython_extension(get_ipython())
# except Exception:
#     pass
# finally:
