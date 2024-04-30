from IPython.core.magic import (
    Magics,
    magics_class,
    line_magic,
    cell_magic,
    line_cell_magic,
)


@magics_class
class pagebreak_magics(Magics):
    _pb = None

    def __init__(pb):
        pass

    @line_magic
    def abra(self, line):
        return line

    @cell_magic
    def pagebreak(self, line, cell):
        print("defined pagebreak", line, cell)
        return line, cell

    @line_cell_magic
    def pb(self, line, cell=None):
        "Magic that works both as %lcmagic and as %%lcmagic"
        if cell is None:
            print("Called as line magic")
            return line
        else:
            print("Called as cell magic")
            return line, cell
