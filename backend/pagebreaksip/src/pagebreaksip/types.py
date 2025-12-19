from dataclasses import dataclass


@dataclass
class astWalkData:
    currentContext: int
    userDefinedVariables: set[str]  # the variables we've defined so far in this scope
    exportedVariables: dict[int, set[str]]  # the variables exported from each scope
    isLineMagic: bool
    namesToIgnore: set[str]
    
    # def __init__(self):
    #     self.currentContext = -1
    #     self.userDefinedVariables = set()  # this will be filled in when we start walking the tree
    #     self.exportedVariables = {}
    #     self.isLineMagic = True
    #     self.namesToIgnore = set()


#TODO add schema type 