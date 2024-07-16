import ast

import pagebreaksip.pagebreaks_ip as pagebreaks_ip
# data = pagebreak.astWalkData(1, {1:pagebreak.trackedNames(),2: pagebreak.trackedNames()},{1:["asf", "f"],2:["foo"]}, True)


class Test_AST:

    def test_groundTest(self):
        pbw = pagebreaks_ip.PagebreaksASTTransformer()
        pbw.setStoredData(
            pagebreaks_ip.astWalkData(
                currentContext=0,
                userDefinedVariables=set(),  # this will be filled in when we start walking the tree
                exportedVariables={},
                isLineMagic=False
            )
        )
        code = """
# This is a comment
import pprint
a,asf = 4,5
class Namespace():
    pass
n = Namespace()
n.a = 4        
def f():
    v = 4
    pprint(a)
    print(adf)
    return a
print(f())"""
        # global_vars = symbolTable.symbolTableManager().find_global_names(code)
        # print("globals:")
        # print(global_vars)
        # pbw.names_to_transform = global_vars
        tree = ast.parse(code, mode="exec")
        node = pbw.visit(tree)
        dump = ast.dump(node, indent=4)
        print(dump)
        assert dump.count("id='a'") == 0
        assert dump.count("attr='a'") == 1
        assert dump.count("id='pb_0_a'") == 3
        assert dump.count("id='asf'") == 0

    def test_namespacesareleftalone(self):
        pbw = pagebreaks_ip.PagebreaksASTTransformer()
        pbw.setStoredData(
            pagebreaks_ip.astWalkData(
                currentContext=0,
                userDefinedVariables=set(),  # this will be filled in when we start walking the tree
                exportedVariables={},
                isLineMagic=False
            )
        )
        code = """
a = 3
class Namespace():
    pass
n = Namespace()
n.a = 4        
"""
        tree = ast.parse(code, mode="exec")
        node = pbw.visit(tree)
        dump = ast.dump(node, indent=4)
        assert dump.count("id='pb_0_a'") == 1
        assert dump.count("id='a'") == 0
        assert dump.count("attr='a'") == 1

    def test_classes(self):
        pbw = pagebreaks_ip.PagebreaksASTTransformer()
        pbw.setStoredData(
            pagebreaks_ip.astWalkData(
                currentContext=0,
                userDefinedVariables=set(),  # this will be filled in when we start walking the tree
                exportedVariables={},
                isLineMagic=False
            )
        )
        code = """
a = 3
b = 2 + a
class Namespace():
    a = 2
    def f(self, toPrint):
        print(self.a)
        print(toPrint)
n = Namespace()
n.a = a
n.f(a)      
"""
        tree = ast.parse(code, mode="exec")
        node = pbw.visit(tree)
        dump = ast.dump(node, indent=4)
        print(dump)
        assert dump.count("id='pb_0_a'") == 4
        assert dump.count("id='a'") == 1
        assert dump.count("attr='a'") == 2

    def test_globalkeyword(self):
        pbw = pagebreaks_ip.PagebreaksASTTransformer()
        pbw.setStoredData(
            pagebreaks_ip.astWalkData(
                currentContext=0,
                userDefinedVariables=set(),  # this will be filled in when we start walking the tree
                exportedVariables={},
                isLineMagic=False
            )
        )
        code = """
a = 1
def f():
    global a
    a = a + 1
    print(a)
print(a)
f()       
"""
        tree = ast.parse(code, mode="exec")
        node = pbw.visit(tree)
        dump = ast.dump(node, indent=4)
        print(dump)
        assert dump.count("id='pb_0_a'") == 5
        assert dump.count("pb_0_a") == 6
        assert dump.count("attr='a'") == 0

    def test_forloop(self):
        pbw = pagebreaks_ip.PagebreaksASTTransformer()
        pbw.setStoredData(
            pagebreaks_ip.astWalkData(
                currentContext=0,
                userDefinedVariables=set(),  # this will be filled in when we start walking the tree
                exportedVariables={},
                isLineMagic=False
            )
        )
        code = """
for i in range(3):
    print(i)
"""
        tree = ast.parse(code, mode="exec")
        node = pbw.visit(tree)
        dump = ast.dump(node, indent=4)
        print(dump)
        assert dump.count("id='pb_0_i'") == 2
        assert dump.count("id='i'") == 0

    def test_with(self):
        pbw = pagebreaks_ip.PagebreaksASTTransformer()
        pbw.setStoredData(
            pagebreaks_ip.astWalkData(
                currentContext=0,
                userDefinedVariables=set(),  # this will be filled in when we start walking the tree
                exportedVariables={},
                isLineMagic=False
            )
        )
        code = """
with open("file.txt", "w") as file:
    file.write("test")
"""
        tree = ast.parse(code, mode="exec")
        node = pbw.visit(tree)
        dump = ast.dump(node, indent=4)
        print(dump)
        assert dump.count("id='pb_0_file'") == 2
