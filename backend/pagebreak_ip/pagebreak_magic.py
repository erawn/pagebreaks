from __future__ import print_function
from IPython.core.magic import (
    Magics,
    magics_class,
    line_magic,
    cell_magic,
    line_cell_magic,
)
import json


@magics_class
class pagebreak_magics(Magics):

    def __init__(self, shell):
        super(pagebreak_magics, self).__init__(shell)
        self.schema = None

    @line_magic
    def print_schema(self, line):
        print(self.schema)
        return line

    @cell_magic
    def pagebreak(self, line, cell):
        print("defined pagebreak", line, cell)
        return line, cell

    @line_cell_magic
    def pb_update(self, line, cell=None):
        "Magic that works both as %lcmagic and as %%lcmagic"
        self.schema = json.loads(line)
        if cell is None:
            print("Called pb update line magic")
            print(line)
            return line
        else:
            print("Called pb update cell magic")
            print(line, "cell:", cell)
            return line, cell
