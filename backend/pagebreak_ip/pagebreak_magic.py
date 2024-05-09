from __future__ import print_function

import json

from IPython.core.magic import (
    Magics,
    cell_magic,
    line_cell_magic,
    line_magic,
    magics_class,
)


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
        # print("defined pagebreak", line, cell)
        return line, cell

    @line_magic
    def pb_update(self, line):
        "Magic that works both as %lcmagic and as %%lcmagic"
        self.schema = json.loads(line)
        # print("Called pb update line magic")
        # print(line)
        return line
