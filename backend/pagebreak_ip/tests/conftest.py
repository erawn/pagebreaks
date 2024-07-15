import pytest
from IPython.terminal.interactiveshell import TerminalInteractiveShell
from IPython.testing.globalipapp import start_ipython

import backend.pagebreak_ip.src.pagebreaks_ip as pagebreaks_ip


@pytest.fixture(scope="session")
def session_ip() -> TerminalInteractiveShell | None:
    return start_ipython()


@pytest.fixture(scope="function")
def ip(session_ip: TerminalInteractiveShell):
    session_ip.run_line_magic(magic_name="load_ext", line="pagebreaks_ip")
    yield session_ip
    session_ip.run_line_magic(magic_name="unload_ext", line="pagebreaks_ip")
    session_ip.run_line_magic(magic_name="reset", line="-f")
