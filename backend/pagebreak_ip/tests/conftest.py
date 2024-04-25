import pytest
from IPython.testing.globalipapp import start_ipython
from IPython.terminal.interactiveshell import TerminalInteractiveShell


@pytest.fixture(scope="session")
def session_ip() -> TerminalInteractiveShell | None:
    return start_ipython()


@pytest.fixture(scope="function")
def ip(session_ip: TerminalInteractiveShell):
    session_ip.run_line_magic(magic_name="load_ext", line="pagebreak.pagebreak")
    yield session_ip
    session_ip.run_line_magic(magic_name="unload_ext", line="pagebreak.pagebreak")
    session_ip.run_line_magic(magic_name="reset", line="-f")
