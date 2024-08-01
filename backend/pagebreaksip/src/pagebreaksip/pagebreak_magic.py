from __future__ import print_function

import ast
import json
import re
import sys
import typing
from typing import Any, Dict, List, Set, Tuple, Type

import jsondiff as jd
import pagebreaksip
from IPython.core.interactiveshell import ExecutionInfo
from IPython.core.magic import (Magics, cell_magic, line_cell_magic,
                                line_magic, magics_class)
from IPython.core.magics.namespace import NamespaceMagics
from IPython.terminal.interactiveshell import TerminalInteractiveShell
from IPython.utils.encoding import DEFAULT_ENCODING
from loguru import logger

study_logger = logger.bind(study=True)
# study_logger = logging.getLogger("pagebreaks_study")
# logger = logging.getLogger("pagebreaks")

reload_regex = re.compile(r"""NAME\[([^\]]*)\]RELOAD_NOTEBOOK:""")
@magics_class
class pagebreak_magics(Magics):

    def __init__(self, shell, pb):
        super(pagebreak_magics, self).__init__(shell)
        self.shell: TerminalInteractiveShell = shell
        self.schema = None
        self.currentJSON = None
        self._pb = pb

    @line_magic
    def print_schema(self, line):
        print(json.dumps(self.schema))
        return

    @line_magic
    def who_pb(self, parameter_s=''):
        varnames = self.shell.run_line_magic('who_ls', parameter_s)
        if not varnames:
            if parameter_s:
                print('No variables match your requested type.')
            else:
                print('Interactive namespace is empty.')
            return
        varnames = typing.cast(List[str], varnames)
        # if we have variables, move on...

        # for these types, show len() instead of data:
        seq_types = ['dict', 'list', 'tuple']

        # for numpy arrays, display summary info
        ndarray_type = None
        if 'numpy' in sys.modules:
            try:
                from numpy import ndarray
            except ImportError:
                pass
            else:
                ndarray_type = ndarray.__name__

        # Find all variable names and types so we can figure out column sizes

        # some types are well known and can be shorter
        abbrevs = {'IPython.core.macro.Macro' : 'Macro'}
        def type_name(v):
            tn = type(v).__name__
            return abbrevs.get(tn,tn)
        def get_type(vv):
            tt = type_name(vv)

            if tt=='instance':
                 return abbrevs.get(str(vv.__class__), str(vv.__class__))
            else:
                return tt
        varsByScope: dict[int, List[Tuple[str,Any,str]]] = {}
        for name in varnames:
            if name.startswith("pb_"):
                scopeName = name.split("_")[1]
                if(scopeName != "export"):
                    scopeNum = int(scopeName)
                    newVal = varsByScope.get(scopeNum,[])
                    newVal.append((name.partition("_"+scopeName+"_")[2],self.shell.user_ns[name],get_type(self.shell.user_ns[name])))
                    # print("new val",newVal)
                    varsByScope.update({scopeNum: newVal})
        # print("vars", varsByScope)
        #need to keep dummy list for formatting
        allVarnames = varnames
        allVarlist = [self.shell.user_ns[n] for n in allVarnames]
        allTypelist = []
        for vv in allVarlist:
            allTypelist.append(get_type(vv))


        varnames = [name for name in varnames if not name.startswith("pb_")]
        varlist = [self.shell.user_ns[n] for n in varnames]
        typelist = []
        for vv in varlist:
            typelist.append(get_type(vv))

        
        # column labels and # of spaces as separator
        varlabel = 'Variable'
        typelabel = 'Type'
        datalabel = 'Data/Info'
        scopeLabel = "Scope"
        exportedLabel = "Export Exist?"
        colsep = 3
        # variable format strings
        vformat    = "{0:<{varwidth}}{1:<{typewidth}}{2:<{scopewidth}}{3:<{exportedwidth}}"
        aformat    = "%s: %s elems, type `%s`, %s bytes"
        # find the size of the columns to format the output nicely
        varwidth = max(max(map(len,allVarnames)), len(varlabel)) + colsep
        typewidth = max(max(map(len,allTypelist)), len(typelabel)) + colsep
        exportedwidth = len(exportedLabel) + colsep
        scopewidth = len(scopeLabel) + colsep
        # table header
        print(varlabel.ljust(varwidth) + typelabel.ljust(typewidth) + scopeLabel.ljust(scopewidth) + exportedLabel.ljust(exportedwidth)
        # + ' '+datalabel+'\n' 
            #   + '-'*(varwidth+typewidth+len(datalabel)+1)
              )
        # and the table itself
        kb = 1024
        Mb = 1048576  # kb**2
        def printEntry(vname: str,var: Any,vtype:str, scope: str = "global", exported:str = ""):
            print(vformat.format(vname, vtype, scope, str(exported), varwidth=varwidth, typewidth=typewidth, scopewidth=scopewidth, exportedwidth=exportedwidth), end='\n')
            # if vtype in seq_types:
            #     print("n="+str(len(var)))
            # elif vtype == ndarray_type:
            #     vshape = str(var.shape).replace(',','').replace(' ','x')[1:-1]
            #     if vtype==ndarray_type:
            #         # numpy
            #         vsize  = var.size
            #         vbytes = vsize*var.itemsize
            #         vdtype = var.dtype

            #     if vbytes < 100000:
            #         print(aformat % (vshape, vsize, vdtype, vbytes))
            #     else:
            #         print(aformat % (vshape, vsize, vdtype, vbytes), end=' ')
            #         if vbytes < Mb:
            #             print('(%s kb)' % (vbytes/kb,))
            #         else:
            #             print('(%s Mb)' % (vbytes/Mb,))
            # else:
            #     try:
            #         vstr = str(var)
            #     except UnicodeEncodeError:
            #         vstr = var.encode(DEFAULT_ENCODING,
            #                             'backslashreplace')
            #     except:
            #         vstr = "<object with id %d (str() failed)>" % id(var)
            #     vstr = vstr.replace('\n', '\\n')
            #     if len(vstr) < 50:
            #         print(vstr)
            #     else:
            #         print(vstr[:25] + "<...>" + vstr[-25:])

        for scopeNum in sorted(varsByScope):
            # print("Pagebreak : ", str(scopeNum))
            for variable in varsByScope[scopeNum]:
                (vName, val, vType) = variable
                printEntry(vName,val,vType,str(scopeNum),str(self.shell.user_ns.get("pb_export_"+vName) is not None))


        for vname,var,vtype in zip(varnames,varlist,typelist):
            printEntry(vname,var,vtype)
        
        
    @cell_magic
    def pb_log(self, line, cell):
        msg = typing.cast(str,cell)
        match = reload_regex.match(msg)
        if match:
            # logger.info("FOUND MATCH")
            name = match.group(1)
            # logger.info("name")
            logger.info(str(name))
            msg = msg[match.end():]
            logger.info("MSG" + str(msg))
            jsonMSG = typing.cast(dict,json.loads(msg, strict=False))
            # logger.info("jsonmsg" +str(type(jsonMSG)) + str(jsonMSG))
            # logger.info("currentJSON" + str(self.currentJSON))
            if not isinstance(name,str):
                name = ""
                logger.info("cant find notebook name!")
            # logger.info(str(name))
            if not self.currentJSON:
                # logger.info("reload" + str(jsonMSG))
                study_logger.info("NOTEBOOK_RELOAD ["+name+"]" + str(jsonMSG))
            else:
                
                diff = typing.cast(dict,jd.diff(self.currentJSON,jsonMSG))
                # if "notebookName" in diff:
                #     study_logger.info("NOTEBOOK_RELOAD" + str(jsonMSG))
                # else:
                logger.info(diff)
                if(len(diff) > 0):
                    logger.info(diff)
                    study_logger.info("NOTEBOOK_UPDATE ["+name+"]" + str(diff))
                # patch = jd.patch(self.currentJSON, json.loads(diff))
                # logger.info("patch" + str(patch == jsonMSG))
            # logger.info("after if")
            # logger.info(str(type(jsonMSG)))
            # logger.info(str(type(self.currentJSON)))
            
            self.currentJSON = jsonMSG
            
            # logger.info("currentJSONAFTER" + str(self.currentJSON))
        else:
            study_logger.info(cell)
        return
    @cell_magic 
    def pb_transform(self,line,cell):
        msg = typing.cast(str,cell)
        cellList = json.loads(msg,strict=False)
        if self.schema == None:
            return

        for cell in cellList:
            if cell.get('type') == 'pagebreak':
                pbnum = cell.get("pbNum")
                # print(pbnum)
                exportvars = self._pb.ast_transformer.getStoredData().exportedVariables.get(pbnum)
                if(exportvars is None):
                    cell["newText"] = ""
                else:
                    base = ast.Module(body=[],type_ignores=[])
                    for var,index in zip(exportvars,range(len(exportvars))):
                        exportName = pagebreaksip.transformName(var,pbnum,True)
                        localName = pagebreaksip.transformName(var,pbnum,False)
                        base.body.append(ast.Assign(targets=[ast.Name(id=exportName,ctx=ast.Store())],value=ast.Name(id=localName,ctx=ast.Load()),lineno=index,col_offset=0))
                    cell["newText"] = ast.unparse(base)
            if cell.get('type') == 'code':
                 
                    # cellsToScopes: dict[str, int] = self.schema.get("cellsToScopes", {})
                    # currentContext: int = cellsToScopes.get(str(cell.get('id')), -1)

                    # if currentContext == -1:
                    #     print('couldnt find scope!')
                    #     break;
                    
                    # data = self._pb.ast_transformer.getStoredData()
                    # data.currentContext = currentContext
                    # self._pb.ast_transformer.setStoredData(data)
                self._pb.pre_run_cell(ExecutionInfo("", False, True, False, cell.get('id')))
                text = cell.get("source")
                program_ast = self.shell.compile.ast_parse(self.shell.transform_cell(text))
                transformed = self._pb.ast_transformer.visit(program_ast)
                newText = ast.unparse(transformed)
                cell["newText"] = newText
                
        print(json.dumps(cellList))
        # program_ast = self.shell.compile.ast_parse(msg)
        # # program_ast = asttokens.ASTTokens(msg,parse=True)
        # transformed = self._pb.ast_transformer.visit(program_ast)
        # print(ast.dump(transformed))
        # Assign(targets=[Name(id='pb_0_a', ctx=Store())], value=Constant(value=2))
        # print(ast.unparse(transformed))
        return
    @line_magic 
    def pb_transform_export(self,line):
        msg = typing.cast(str,line)
        pbnum = int(msg)
        print(pbnum)
        exportvars = self._pb.ast_transformer.getStoredData().exportedVariables.get(pbnum)
        print(exportvars)
        base = ast.Module(body=[],type_ignores=[])
        
        for var,index in zip(exportvars,range(len(exportvars))):
            exportName = pagebreaksip.transformName(var,pbnum,True)
            localName = pagebreaksip.transformName(var,pbnum,False)
            base.body.append(ast.Assign(targets=[ast.Name(id=exportName,ctx=ast.Store())],value=ast.Name(id=localName,ctx=ast.Load()),lineno=index,col_offset=0))
        print(ast.unparse(base))
        return 
    @cell_magic
    def pb_update(self, line, cell):
        "Magic that works both as %lcmagic and as %%lcmagic"
        schema = json.loads(cell)
        logger.info("pb_update" + str(schema))
        self.schema = schema
        self.shell.user_ns["___pbschema"] = schema
        # print("Called pb update line magic")
        # print(line)
        return
