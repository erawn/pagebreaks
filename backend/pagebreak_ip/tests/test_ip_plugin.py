import ast
import sys
from pprint import pprint

import expecttest
import pytest
from hypothesis import given
from hypothesis.strategies import lists, text
from IPython.terminal.interactiveshell import TerminalInteractiveShell
from IPython.utils.capture import capture_output


class Test_IP:

    def test_default(self, ip: TerminalInteractiveShell):
        ip.run_line_magic(
            "pb_update",
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
        ip.run_line_magic(
            "pb_update",
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
        ip.run_line_magic(
            "pb_update",
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
