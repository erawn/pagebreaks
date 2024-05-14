from __future__ import print_function

import json
import logging
import sys
from typing import Any

from IPython.core.magic import (
    Magics,
    cell_magic,
    line_cell_magic,
    line_magic,
    magics_class,
)
from IPython.terminal.interactiveshell import TerminalInteractiveShell

logger = logging.getLogger("pagebreaks").addHandler(logging.StreamHandler(sys.stdout))

schema: Any = None


@magics_class
class pagebreak_magics(Magics):

    def __init__(self, shell):
        super(pagebreak_magics, self).__init__(shell)
        self.shell: TerminalInteractiveShell = shell
        self.schema = None

    @line_magic
    def print_schema(self, line):
        print(self.schema)
        return

    @cell_magic
    def pagebreak(self, line, cell):
        # print("defined pagebreak", line, cell)
        return line, cell

    @cell_magic
    def pb_update(self, line, cell):
        "Magic that works both as %lcmagic and as %%lcmagic"
        schema = json.loads(cell)
        logging.info("pb_update" + str(schema))
        self.schema = schema
        self.shell.user_ns["___pbschema"] = schema
        # print("Called pb update line magic")
        # print(line)
        return
