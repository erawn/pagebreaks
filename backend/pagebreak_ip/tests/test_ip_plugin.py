import pytest
from IPython.terminal.interactiveshell import TerminalInteractiveShell
from hypothesis import given
from hypothesis.strategies import text, lists
import pagebreaks_ip as pagebreaks
import ast
from pprint import pprint
import expecttest

import sys


class Test_IP:

    def test_default(self, ip: TerminalInteractiveShell):
        ip.run_line_magic(
            "pb_update",
            r"""{"cellsToScopes":{"1":0},"scopeList":{"0":["d","f"]}}""",
        )
        ip.run_cell(
            raw_cell="""
x = 2
print(2)
                    """,
            cell_id="1",
        )
        assert ip.user_ns["pb_0_x"] == 2
