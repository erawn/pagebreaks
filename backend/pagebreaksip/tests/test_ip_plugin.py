
import typing

import numpy as np
from IPython.terminal.interactiveshell import TerminalInteractiveShell
from IPython.utils.capture import capture_output
from pagebreaksip.pagebreaks_ip import PagebreaksASTTransformer


class Test_IP:

    def test_default(self, ip: TerminalInteractiveShell):
        ip.run_cell_magic(
            "pb_update",
            "",
            r"""{"cellsToScopes":{"1":0},"scopeList":{"0":["d","f"]}}""",
        )
        ip.run_cell(
            raw_cell="""
x = 2
print(x)
                    """,
            cell_id="1",
        )
        assert ip.user_ns["pb_0_x"] == 2

    def test_function(self, ip: TerminalInteractiveShell):
        ip.run_cell_magic(
            "pb_update",
            "",
            r"""{"cellsToScopes":{"1":0,"2":1},"scopeList":{"0":["f"],"1":[""]}}""",
        )
        ip.run_cell(
            raw_cell="""
a = 2
def f():
    print("a =",a)
                    """,
            cell_id="1",
        )
        with capture_output() as capture:
            ip.run_cell(
                raw_cell="f()\n",
                cell_id="2",
            )
        assert "a = 2" in capture.stdout

    def test_function2(self, ip: TerminalInteractiveShell):
        ip.run_cell_magic(
            "pb_update",
            "",
            r"""{"cellsToScopes":{"1":0,"2":1},"scopeList":{"0":["f"],"1":[""]}}""",
        )
        ip.run_cell(
            raw_cell="""
    a = 2
    def f():
        b = 5
        def g():
            print("b =",b)
        print("a =",a)
        return g """,
            cell_id="1",
        )
        with capture_output() as capture:
            ip.run_cell(
                raw_cell="f()()\n",
                cell_id="2",
            )
        assert "a = 2" in capture.stdout
        assert "b = 5" in capture.stdout

    def test_delNamesAfterError(self, ip: TerminalInteractiveShell):
        ip.run_cell_magic(
            "pb_update",
            "",
            r"""{"cellsToScopes":{"1":0,"2":1},"scopeList":{"0":[""],"1":["a"]}}""",
        )
        ip.run_cell(
            raw_cell="""
    a = 2
    a/0
    """,
            cell_id="1",
        )
        found = False
        for transformer in ip.ast_transformers: # type: ignore
            print (str(type(transformer)))
            if str(type(transformer)) == "<class 'pagebreaksip.pagebreaks_ip.PagebreaksASTTransformer'>":
                found = True
                astTransform = typing.cast(PagebreaksASTTransformer,transformer)
                assert not 'a' in astTransform.userVariables.get(0, set())
        assert found


    def test_outoforder(self, ip: TerminalInteractiveShell):
        ip.run_cell_magic(
            "pb_update",
            "",
            r"""{"cellsToScopes":{"1":0,"2":1},"scopeList":{"0":[""],"1":["a"]}}""",
        )
        ip.run_cell(
            raw_cell="""
    a = 2""",
            cell_id="2",
        )
        with capture_output() as capture:
            ip.run_cell(
                raw_cell="print(a)\n",
                cell_id="1",
            )
        assert "NameError: name 'a' is not defined" in capture.stdout

    def test_class(self, ip: TerminalInteractiveShell):
        ip.run_cell_magic(
            "pb_update",
            "",
            r"""{"cellsToScopes":{"1":0,"2":1},"scopeList":{"0":["c"],"1":[""]}}""",
        )
        ip.run_cell(
            raw_cell="""
class c:
    b = 2

c.a = 3""",
            cell_id="1",
        )
        with capture_output() as capture:
            ip.run_cell(
                raw_cell='print("b =",c.b)\nprint("a =",c.a)',
                cell_id="2",
            )
        print(capture)
        assert "a = 3" in capture.stdout
        assert "b = 2" in capture.stdout

    # def test_pbupdate(self, ip: TerminalInteractiveShell):
    #     with capture_output() as capture:
    #         ip.run_cell_magic(
    #             "pb_update",
    #             r"""{"cellsToScopes":{"de8177c4-a85f-4eae-8b26-ab5cb15a5923":0,"c7ad8658-6343-4570-9bb6-594a3bca9bf8":0,"cf6ee285-2104-47f9-8a31-f5509a06ff21":0,"9f662aa2-bb7f-40f0-be0d-016b1d646f7a":0,"bfd2ddd6-6eda-44aa-a391-de3694b4761f":0,"1c35e1bf-916d-46ce-8d30-c014013849b7":0,"f4850486-8be5-43d4-bbea-e860ab3ccd26":0,"298a20cd-4ce3-4513-a394-d093b6fe82d9":0,"f5549241-a653-4e36-ac39-b1f877942069":0,"6011ad04-19fb-4cd3-8c59-1f79775216c2":1,"40608d2d-00fc-43f2-8651-bcae075a6ad8":1,"7c6355f4-44ea-4c11-8ce8-4cf2567452d3":1,"4817584d-ccf3-495b-8695-15ad475ab56b":1,"4f49be85-3cf9-4ae4-b556-42993483c426":2,"885235c3-e063-4050-bac7-71c2a4e4a124":2,"fd2fe05c-7739-47fa-a80e-643781be2b7f":3,"1c7bedff-8a64-45b2-a82c-54f220166a12":3,"7875ddba-cfaa-4b2f-9bf6-bf1b108bc4b1":4,"59635ffc-7196-4005-b425-4c1a556f8303":5},"scopeList":{"0":["d","c","myclass","sfdg"],"1":["h"],"2":[""],"3":[""],"4":[""]},"scopes":[{"index":9,"pbNum":0,"exportedVariables":["d","c","myclass","sfdg"]},{"index":14,"pbNum":1,"exportedVariables":["h"]},{"index":17,"pbNum":2,"exportedVariables":[""]},{"index":20,"pbNum":3,"exportedVariables":[""]},{"index":23,"pbNum":4,"exportedVariables":[""]}]}""",
    #         )
    #     print("Capture", capture.stdout)
    #     assert 1 == 2

    ##update pbs between runs
    def test_schema_change(self, ip: TerminalInteractiveShell):
        ip.run_cell_magic(
            "pb_update",
            "",
            r"""{"cellsToScopes":{"1":0,"2":1},"scopeList":{"0":["sf"],"1":[""]}}""",
        )
        ip.run_cell(
            raw_cell="""
sf = 21
sfd = 11""",
            cell_id="1",
        )

        for name in ["pb_0_sf", "pb_0_sfd"]:
            assert name in ip.user_ns

        ip.run_cell(
            raw_cell="""
print(sf)""",
            cell_id="2",
        )
        for name in ["pb_0_sf", "pb_0_sfd", "pb_export_sf"]:
            assert name in ip.user_ns

        ip.run_cell_magic(
            "pb_update",
            "",
            r"""{"cellsToScopes":{"1":0,"2":1},"scopeList":{"0":["sfd"],"1":[""]}}""",
        )
        ip.run_cell(
            raw_cell="""
print(sfd)""",
            cell_id="2",
        )
        for name in ["pb_0_sf", "pb_0_sfd", "pb_export_sfd"]:
            assert name in ip.user_ns
        assert "pb_export_sf" not in ip.user_ns

    def test_local_variable_reset(self, ip: TerminalInteractiveShell):
        ip.run_cell_magic(
            "pb_update",
            "",
            r"""{"cellsToScopes":{"1":0,"2":1},"scopeList":{"0":["c", "myclass"],"1":[""]}}""",
        )
        ip.run_cell(
            raw_cell="""
class c:
    pass
c.a = 3
myclass = c()
myclass.a = 4
""",
            cell_id="1",
        )

        for name in ["pb_0_c", "pb_0_myclass"]:
            assert name in ip.user_ns
        ip.run_cell(
            raw_cell="""
test = 191""",
            cell_id="2",
        )
        ip.run_cell(
            raw_cell="""
test = myclass.a
myclass.a = 11""",
            cell_id="2",
        )
        assert ip.user_ns.get("pb_1_test") == 191
        print(ip.user_ns)
        assert not "pb_export_myclass" in ip.user_ns
        ip.run_cell(
            raw_cell="""
test""",
            cell_id="2",
        )
        assert ip.user_ns.get("pb_export_c").a == 3  # type: ignore
        assert ip.user_ns.get("pb_export_myclass").a == 4  # type: ignore

class Test_Comparison:

    def test_np(self, ip: TerminalInteractiveShell):
        ip.run_cell_magic(
            "pb_update",
            "",
            r"""{"cellsToScopes":{"1":0,"2":1},"scopeList":{"0":["a"],"1":[""]}}""",
        )
        ip.run_cell(
            raw_cell="""
import numpy as np
a = np.array((1,1,2))
                    """,
            cell_id="1",
        )
        with capture_output() as capture:
            ip.run_cell(
                    raw_cell="""
a.fill(0)
                            """,
                    cell_id="2",
                )
        assert "PagebreakError: Attempted to Overwrite Read-Only Exported Variables: 'a'" in capture.stdout
        assert ip.user_ns.get("pb_export_a") == None
##variable resets

## error messages

class Test_IgnoreNames:

    def test_ignore(self, ip: TerminalInteractiveShell):
        ip.run_cell_magic(
            "pb_update",
            "",
            r"""{"cellsToScopes":{"1":0,"2":1},"scopeList":{"0":["a"],"1":[""]}}""",
        )
        ip.run_cell(
            raw_cell="""
#pagebreaks: ignore_name d
#pagebreaks: ignore_name testing
c = 3
d = c
testing = d
                    """,
            cell_id="1",
        )
        assert ip.user_ns.get("pb_0_c") == 3
        assert ip.user_ns.get("pb_0_d") == None
        assert ip.user_ns.get("d") == 3
        assert ip.user_ns.get("pb_0_testing") == None
        assert ip.user_ns.get("testing") == 3

class Test_Transform:


    # def test_send(self,ip: TerminalInteractiveShell):
        # with capture_output() as capture:
        #     ip.run_cell_magic(
        #         "pb_transform",
        #         "",
        #         r"""[{"index":1,"id":"3a7c2ec7-28d6-4333-9cca-1a5830504fd3","type":"code","variables":[],"source":"a = 3"},{"index":2,"id":"bdbb7230-eb78-437a-a298-db99f0cab3c8","type":"pagebreak","variables":[["a"]],"pbNum":0},{"index":4,"id":"5aadb64c-c5cc-4b4a-b0c8-e818627ade38","type":"code","variables":[],"source":"print(a)"},{"index":5,"id":"f382994c-0c95-4c35-bb8f-30e13cdf3df5","type":"pagebreak","variables":[[]],"pbNum":1},{"index":6,"id":"42afe96b-0bc3-4fd7-b130-fa0e79a3e0b3","type":"code","variables":[],"source":""}]""",
        #     )
        # assert """[{"index": 1, "id": "3a7c2ec7-28d6-4333-9cca-1a5830504fd3", "type": "code", "variables": [], "source": "a = 3", "newText": "pb_0_a = 3"}, {"index": 2, "id": "bdbb7230-eb78-437a-a298-db99f0cab3c8", "type": "pagebreak", "variables": [["a"]], "pbNum": 0, "newText": "pb_export_pagebreaks_simulated = pb_0_pagebreaks_simulated"}, {"index": 4, "id": "5aadb64c-c5cc-4b4a-b0c8-e818627ade38", "type": "code", "variables": [], "source": "print(a)", "newText": "print(pb_0_a)"}, {"index": 5, "id": "f382994c-0c95-4c35-bb8f-30e13cdf3df5", "type": "pagebreak", "variables": [[]], "pbNum": 1, "newText": ""}, {"index": 6, "id": "42afe96b-0bc3-4fd7-b130-fa0e79a3e0b3", "type": "code", "variables": [], "source": "", "newText": ""}]""" in capture.stdout
    def test_send2(self,ip: TerminalInteractiveShell):
        ip.run_cell_magic(
            "pb_update",
            "",
            r"""{"cellsToScopes": {"96213e44-5add-4916-99aa-bdf92ee22c2e": 0, "3a7c2ec7-28d6-4333-9cca-1a5830504fd3": 0, "c20d84b7-61a5-4255-aa09-24285a3b9c08": 1, "ea972339-1123-465f-a881-d165edfdaa26": 1, "b50e91d7-1d06-41bd-b5d5-d02598d40926": 2, "5aadb64c-c5cc-4b4a-b0c8-e818627ade38": 2, "42afe96b-0bc3-4fd7-b130-fa0e79a3e0b3": 3, "be1ea651-7993-4396-9d0e-a4226de83598": 3, "fb4b3cdd-43c3-4238-a842-44b6009d24f7": 3}, "scopeList": {"0": ["a", "b"], "1": [], "2": []}, "scopes": [{"index": 2, "pbNum": 0, "exportedVariables": ["a", "b"], "id": "bdbb7230-eb78-437a-a298-db99f0cab3c8"}, {"index": 5, "pbNum": 1, "exportedVariables": [], "id": "0f02ee7d-318d-42b2-b9d1-874cef777c8c"}, {"index": 8, "pbNum": 2, "exportedVariables": [], "id": "f382994c-0c95-4c35-bb8f-30e13cdf3df5"}], "cellList": [{"index": 0, "id": "96213e44-5add-4916-99aa-bdf92ee22c2e", "type": "header", "variables": []}, {"index": 1, "id": "3a7c2ec7-28d6-4333-9cca-1a5830504fd3", "type": "code", "variables": []}, {"index": 2, "id": "bdbb7230-eb78-437a-a298-db99f0cab3c8", "type": "pagebreak", "variables": ["a", "b"]}, {"index": 3, "id": "c20d84b7-61a5-4255-aa09-24285a3b9c08", "type": "header", "variables": []}, {"index": 4, "id": "ea972339-1123-465f-a881-d165edfdaa26", "type": "code", "variables": []}, {"index": 5, "id": "0f02ee7d-318d-42b2-b9d1-874cef777c8c", "type": "pagebreak", "variables": []}, {"index": 6, "id": "b50e91d7-1d06-41bd-b5d5-d02598d40926", "type": "header", "variables": []}, {"index": 7, "id": "5aadb64c-c5cc-4b4a-b0c8-e818627ade38", "type": "code", "variables": []}, {"index": 8, "id": "f382994c-0c95-4c35-bb8f-30e13cdf3df5", "type": "pagebreak", "variables": []}, {"index": 9, "id": "42afe96b-0bc3-4fd7-b130-fa0e79a3e0b3", "type": "code", "variables": []}, {"index": 10, "id": "be1ea651-7993-4396-9d0e-a4226de83598", "type": "code", "variables": []}, {"index": 11, "id": "fb4b3cdd-43c3-4238-a842-44b6009d24f7", "type": "code", "variables": []}]}""",
        )
        with capture_output() as capture:
            ip.run_cell_magic(
                "pb_transform",
                "",
                r"""[{"index":1,"id":"3a7c2ec7-28d6-4333-9cca-1a5830504fd3","type":"code","variables":[],"source":"a = 3\nc = 2"},{"index":2,"id":"bdbb7230-eb78-437a-a298-db99f0cab3c8","type":"pagebreak","variables":[["a","b"]],"pbNum":0},{"index":4,"id":"ea972339-1123-465f-a881-d165edfdaa26","type":"code","variables":[],"source":"c = 3\nprint(b)"},{"index":5,"id":"0f02ee7d-318d-42b2-b9d1-874cef777c8c","type":"pagebreak","variables":[[]],"pbNum":1},{"index":7,"id":"5aadb64c-c5cc-4b4a-b0c8-e818627ade38","type":"code","variables":[],"source":"print(c)"},{"index":8,"id":"f382994c-0c95-4c35-bb8f-30e13cdf3df5","type":"pagebreak","variables":[[]],"pbNum":2},{"index":9,"id":"fb4b3cdd-43c3-4238-a842-44b6009d24f7","type":"code","variables":[],"source":""}]""",
            )
        
        assert r"""[{"index": 1, "id": "3a7c2ec7-28d6-4333-9cca-1a5830504fd3", "type": "code", "variables": [], "source": "a = 3\nc = 2", "newText": "pb_0_a = 3\npb_0_c = 2"}, {"index": 2, "id": "bdbb7230-eb78-437a-a298-db99f0cab3c8", "type": "pagebreak", "variables": [["a", "b"]], "pbNum": 0, 
        """
        assert r"""newText": "pb_export_a = pb_0_a\npb_export_b = pb_0_b"}""" in capture.stdout or r"""newText": "pb_export_b = pb_0_b\npb_export_a = pb_0_a"}""" in capture.stdout
        assert r"""{"index": 4, "id": "ea972339-1123-465f-a881-d165edfdaa26", "type": "code", "variables": [], "source": "c = 3\nprint(b)", "newText": "pb_1_c = 3\nprint(b)"}, {"index": 5, "id": "0f02ee7d-318d-42b2-b9d1-874cef777c8c", "type": "pagebreak", "variables": [[]], "pbNum": 1, "newText": ""}, {"index": 7, "id": "5aadb64c-c5cc-4b4a-b0c8-e818627ade38", "type": "code", "variables": [], "source": "print(c)", "newText": "print(c)"}, {"index": 8, "id": "f382994c-0c95-4c35-bb8f-30e13cdf3df5", "type": "pagebreak", "variables": [[]], "pbNum": 2, "newText": ""}""" in capture.stdout
