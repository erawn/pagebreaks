import ast
from dataclasses import dataclass
import copy
from typing import List, Tuple, Set, Dict, Type
from IPython.core.error import InputRejected
from IPython.testing.globalipapp import start_ipython
from IPython.terminal.interactiveshell import TerminalInteractiveShell

DEBUG = True


# class NameAdder(ast.NodeTransformer):

#     def __init__(self):
#         self.namesFound = []

#     def visit_Name(self, node: ast.Name):
#         self.namesFound.append(node.id)
#         return node


class baseASTTransform(ast.NodeTransformer):

    def __init__(self):
        self.storedData = None

    def visit(self, node, data=None):
        if data == None:  # top level call
            data = self.storedData
        method = "visit_" + node.__class__.__name__
        visitor = getattr(self, method, self.generic_visit)
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


@dataclass
class astWalkData:
    currentContext: int
    userDefinedVariables: set[str]
    exportedVariables: dict
    scopeDepth: int


class PagebreaksASTTransformer(baseASTTransform):

    currentContext = 1
    userVariables: dict[int, set[str]] = {}
    exportedVariables = {1: {"asf", "f"}, 2: {"foo"}}

    def __init__(self):
        self.storedData = astWalkData(
            self.currentContext,
            self.userVariables.get(self.currentContext, set()),
            self.exportedVariables,
            0,
        )

    def transformName(self, name: str, context: int):
        return "pb_" + str(context) + "_" + name

    # always called first as the top level AST node, we're going to walk the tree and find
    # all the global definitions with a separate transformer, "variableFinder"
    def visit_Module(self, node: ast.Module, data: astWalkData):
        defFinder = DefinitionsFinder()
        trackedNames = defFinder.getDefinitionsAtNode(node)
        if DEBUG:
            print("New Definitions Found:")
            print(trackedNames)
        savedVariables = self.userVariables.get(data.currentContext, set())
        savedVariables.update(trackedNames)
        data.userDefinedVariables.update(savedVariables)
        self.generic_visit(node, data)
        return node

    def visit_Name(self, node, data: astWalkData):
        # check if variable is exported from another context
        for context in data.exportedVariables.keys():
            if (
                context is not data.currentContext
                and node.id in data.exportedVariables.get(context, set())
                and context < data.currentContext
            ):  # only modify variables in later contexts

                if DEBUG:
                    print(
                        "changing name ["
                        + node.id
                        + "] to ["
                        + self.transformName(node.id, context)
                        + "]"
                    )
                if isinstance(
                    node.ctx, ast.Store
                ):  # we can only statically check for re-assignments of exported variables. On plug-in itself we'll dynamically check for exported variables changing.
                    raise InputRejected(
                        """PagebreaksError: Attempted to Redefine Exported Variable: '"""
                        + str(node.id)
                        + """' elsewhere in the notebook"""
                    )  # the only kind of error we can raise, otherwise IPython will disable the transformer
                return ast.Name(id=self.transformName(node.id, context), ctx=node.ctx)
        print(type(node.ctx))
        if node.id in data.userDefinedVariables:
            if DEBUG:
                print(
                    "changing name ["
                    + node.id
                    + "] to ["
                    + self.transformName(node.id, data.currentContext)
                    + "]"
                )
            return ast.Name(
                id=self.transformName(node.id, data.currentContext), ctx=node.ctx
            )

        return node

    # we dont want to touch anything in import statements
    def visit_Import(self, node, data: astWalkData):
        return node

    def visit_Global(self, node: ast.Global, data: astWalkData):
        def transformName(name):
            if name in data.userDefinedVariables:
                return self.transformName(name, data.currentContext)
            else:
                return name

        newNames = list(map(transformName, node.names))
        return ast.Global(names=newNames)

    def visit_FunctionDef(self, node, data: astWalkData):
        return self.handleNewBlock(node, data)

    def visit_ClassDef(self, node: ast.ClassDef, data: astWalkData):
        return self.handleNewBlock(node, data)

    def handleNewBlock(self, node, data):
        if node.name in data.userDefinedVariables:
            node.name = self.transformName(node.name, data.currentContext)
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

        data.scopeDepth += 1
        self.generic_visit(node, data)
        return node


class Pagebreak(object):
    def __init__(self, ip: TerminalInteractiveShell):
        self.shell = ip
        self.ast_transformer = PagebreaksASTTransformer()
        self.shell.ast_transformers.append(self.ast_transformer)
        self.current_context: int = 0

    def set_current_context(self, newcontext: int):
        self.current_context = newcontext
        self.ast_transformer.currentContext = newcontext

    def pre_run_cell(self, info):
        # temporary: change contexts with simple pragma
        first_line = info.raw_cell.partition("\n")[0]
        if first_line.startswith("#changeContexts"):
            arg = first_line.partition(" ")[2]
            if DEBUG:
                print("Setting context to :[" + arg + "]")
            self.set_current_context(int(arg))
        self.shell.meta["pagebreak"] = "this is a test"

        # set the current context

        # check for updates to pagebreak cells

        # save the current state

    def post_run_cell(self, result):
        pass

    def load_metadata(self):
        return


# class _VarWatcher(object):


#     def get_user_vars(self, shell, parameter_s=''):
#         user_ns = shell.user_ns
#         user_ns_hidden = shell.user_ns_hidden
#         nonmatching = object()  # This can never be in user_ns
#         user_ns_to_save = {name: val for name, val in user_ns.items()
#             if not name.startswith('_') \
#                 and not name.startswith('user_ns') \
#                 and (user_ns[name] is not user_ns_hidden.get(name, nonmatching)) }


#         # typelist = parameter_s.split()
#         # if typelist:
#         #     typeset = set(typelist)
#         #     out = [i for i in out if type(user_ns[i]).__name__ in typeset]

#         # out.sort()
#         return user_ns_to_save


#     def __init__(self, ip):
#         self.shell = ip
#         self.last_x = None
#         self.contexts = {0:{'state' : {}, 'tracked_vars' : []},
#                         1: {'state' : {'d':3}, 'tracked_vars' : ['d', 'e']}, \
#                          2:{'state': {'a':2}, 'tracked_vars': ['a','b','c','f']}} # Dummy Value for Testing
#         self.all_tracked_vars = list(itertools.chain.from_iterable(self.contexts[key]['tracked_vars'] for key in self.contexts)) # long way of getting all tracked vars across all contexts
#         self.pbvarsglobalsave = None
#         self.current_context = 0 # default value
#         self.ast_transformer = PagebreaksWrapper()
#         self.shell.ast_transformers.append(self.ast_transformer)
#         #LOOK FOR PAGEBREAKS, MAKE LIST OF TRACKED VARS

#     def pre_run_cell(self, info):
#         #CHECK IF IN PB

#         #IF SO
#         _shell = self.shell
#         _user_ns = _shell.user_ns
#         _user_ns_hidden = _shell.user_ns_hidden
#         _nonmatching = object()

#         #get current context (currently a hack)
#         first_line = info.raw_cell.partition('\n')[0]
#         if first_line.startswith('#changeContexts'):
#             arg = first_line.partition(' ')[2]
#             print('Setting context to :['+arg+']')
#             self.current_context = int(arg)

#         #SAVE USER_NS
#         self.pbvarsglobalsave = self.get_user_vars(self.shell).copy()

#         # exported

#         # If existing context exists, load it
#         if self.current_context in self.contexts:
#             _shell.push(self.contexts[self.current_context]['state'])
#         else:
#             self.contexts[self.current_context] = {'state' : {}, 'tracked_vars' : []}

#         print("current context is: ["+str(self.current_context)+"]")
#         pprint.pprint(self.contexts[self.current_context])

#         # pprint.pprint(get_user_vars(_shell))
#         # print('info.raw_cell =', info.raw_cell)
#         # print('info.store_history =', info.store_history)
#         # print('info.silent =', info.silent)
#         # print('info.shell_futures =', info.shell_futures)

#         # print(info.)
#         print('RUNNING CELL')

#     def post_run_cell(self, result):
#         #if cell errored, revert

#         print('FINISHED RUNNING CELL')
#         #if cell exited successfully
#         _shell = self.shell
#         _user_ns = _shell.user_ns
#         _user_ns_hidden = _shell.user_ns_hidden
#         _nonmatching = object()


#         #get user variables
#         _user_ns_to_save = self.get_user_vars(_shell).copy()

#         #get vars to promote
#         _vars_to_promote = self.contexts[self.current_context]['tracked_vars']

#         #initialize to avoid errors loading
#         if self.pbvarsglobalsave is None:
#             self.pbvarsglobalsave = _user_ns_to_save

#         # Check for overwrites of read-only variables
#         for read_only_var in self.all_tracked_vars:
#             if read_only_var not in _vars_to_promote and \
#                 self.pbvarsglobalsave.get(read_only_var) != _shell.user_ns.get(read_only_var):
#                 #revert state and raise an exception
#                 _shell.drop_by_id(_user_ns_to_save) #cant use user variables after this point!
#                 _shell.push(self.pbvarsglobalsave)
#                 raise ValueError('\'' + read_only_var + '\' is read-only')

#         # if we didn't overwrite something we weren't supposed to, save the current context
#         self.contexts[self.current_context]['state'] = _user_ns_to_save.copy()

#         print("new context is: ["+str(self.current_context)+"]")
#         pprint.pprint(self.contexts[self.current_context])

#         # load our global context
#         _shell.drop_by_id(_user_ns_to_save) #cant use user variables after this point!
#         _shell.push(self.pbvarsglobalsave)

#         # promote our designated variables forward
#         _dict_to_promote = {key: self.contexts[self.current_context]['state'][key] for key in _vars_to_promote if key in self.contexts[self.current_context]['state']}

#         #simulate closures for any exported functions
#         #print('info.raw_cell =', result.info.raw_cell)
#         #cell_symtable = self.generate_symtable(result.info.raw_cell, DEBUG=False)
#         # tab = self.search_symboltable(cell_symtable, 'f', DEBUG=False)


#         # print("variables promoted")
#         # pprint.pprint(_dict_to_promote)
#         _shell.push(_dict_to_promote)

_pb: Pagebreak | None = None


def load_ipython_extension(ip: TerminalInteractiveShell):
    _pb = Pagebreak(ip)
    ip.events.register("pre_run_cell", _pb.pre_run_cell)
    ip.events.register("post_run_cell", _pb.post_run_cell)


def unload_ipython_extension(ip: TerminalInteractiveShell):
    if _pb is not None:
        ip.events.unregister("pre_run_cell", _pb.pre_run_cell)  # type: ignore
        ip.events.unregister("post_run_cell", _pb.post_run_cell)  # type: ignore


# try:
#     unload_ipython_extension(get_ipython())
# except Exception:
#     pass
# finally:
