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
        ip.run_cell(
            raw_cell="""
x = 2
print(2)
                    """
        )
        assert ip.user_ns["pb_1_x"] == 2
