import itertools
from collections.abc import Iterable, Iterator, Mapping, Sequence
from operator import eq
from typing import Any, Dict, List, Set, Tuple, Type
import numpy as np
from loguru import logger
from pandas import DataFrame, Series


def nested_equal(localVar:Any, globalVar:Any) -> bool:
        if localVar.__class__ != globalVar.__class__:
            logger.info("classes dont match")
            return False
        # for types that implement their own custom strict equality checking
        seq = getattr(localVar, "seq", None)
        if seq and callable(seq):
            logger.info("seq" + str(seq(globalVar)))
            return seq(globalVar) # type: ignore
        #     # Check equality according to type type [sic].
        # if isinstance(localVar, basestring):
        #     return localVar == globalVar

        if isinstance(localVar, np.ndarray):
            logger.info("ndarray" + str(bool(np.all(localVar == globalVar))))
            return bool(np.all(localVar == globalVar))
        if isinstance(localVar, Sequence):
            isEqual = all(itertools.starmap(eq, zip(localVar, globalVar)))
            logger.info("Sequence" + str(isEqual))
            return isEqual
            # return all(self.nested_equal(x, y) for x, y in zip(localVar, globalVar))
        if isinstance(localVar, Mapping):
            if set(localVar.keys()) != set(globalVar.keys()):
                return False
            return all(nested_equal(localVar[k], globalVar[k]) for k in localVar.keys())
        if isinstance(localVar, Set):
            return localVar == globalVar
        if isinstance(localVar, Series):
            return localVar.equals(globalVar)
        if isinstance(localVar, DataFrame):
            return localVar.equals(globalVar)
        if hasattr(localVar, "__dict__") and hasattr(globalVar, "__dict__"):
            logger.info("comparing __dict__s")
            for localVal, globalVal in zip(localVar.__dict__,globalVar.__dict__):
                if not nested_equal(localVal,globalVal):
                    logger.info("dicts dont match")
                    logger.info(str(localVar.__dict__))
                    logger.info(str(globalVar.__dict__))
                    return False
        isEqual = (localVar == globalVar)
        if isinstance(isEqual,Iterable):
            return all(isEqual)
        if isinstance(isEqual, bool):
            # print(localVar)
            # print(globalVar)
            return isEqual
        #TODO make into an exception, make detailed error message 
        logger.error("Pagebreaks couldn't check an exported variable, please report this error message at github.com/erawn/pagebreaks/issues:" + str(isEqual.__class__))
        #https://stackoverflow.com/questions/18376935/best-practice-for-equality-in-python
#         from collections import Sequence, Mapping, Set
# import numpy as np

# def nested_equal(a, b):
#     """
#     Compare two objects recursively by element, handling numpy objects.

#     Assumes hashable items are not mutable in a way that affects equality.
#     """
#     # Use __class__ instead of type() to be compatible with instances of 
#     # old-style classes.
    # if a.__class__ != b.__class__:
    #     return False

#     # for types that implement their own custom strict equality checking
#     seq = getattr(a, "seq", None)
#     if seq and callable(seq):
#         return seq(b)

#     # Check equality according to type type [sic].
#     if isinstance(a, basestring):
#         return a == b
#     if isinstance(a, np.ndarray):
#         return np.all(a == b)
#     if isinstance(a, Sequence):
#         return all(nested_equal(x, y) for x, y in zip(a, b))
#     if isinstance(a, Mapping):
#         if set(a.keys()) != set(b.keys()):
#             return False
#         return all(nested_equal(a[k], b[k]) for k in a.keys())
#     if isinstance(a, Set):
#         return a == b
#     return a == b
        return False