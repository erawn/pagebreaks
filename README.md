# Pagebreaks : Scope Boundaries for Jupyter Notebooks

Pagebreaks is a research project which explores how notebook programming enviornments could support scope boundaries _around groups of cells_. It is a Jupyter Notebooks extension (with a supporting IPython plugin) which creates scope boundaries between groups of cells in a Jupyter Notebook, allowing cells within a pagebreak to share state as usual, but preventing access from the rest of the notebook.

## This is a Research Project!

I (Eric Rawn) and my collaborators at UC Berkeley are currently studying how Jupyter programmers use Pagebreaks in their everyday work. If you would be interested in participating, please fill out the [interest form](https://forms.gle/6x8wXnEKA12KnVyU6) and we'll be in contact! If you have any questions, you can email me at erawn@berkeley.edu. 

## Install

To install the extension, execute:

```bash
pip install pagebreaks
```


## The Interface

<table align="center">
    <tr>
              <td align="left">Each "pagebreak" keeps top-level variables isolated, so that within a pagebreak you can reference variables between cells normally, but in the rest of the notebook those variables will be inaccessible:.</td>
            <td align="center" width="40%"><img width="600" alt="showscopebound" src="https://github.com/erawn/pagebreaks/assets/26943712/d8552e7a-c151-4bb4-98a6-40e7090902a3">
    </tr>
      <tr>
                <td align="left">To reference a variable defined in an earlier Pagebreak, add the variable to the “export” list at the bottom of the Pagebreak in which it was defined. Once it’s exported, later cells can read its value, but they can’t overwrite it</td>
             <td align="center" width="30%"><img width="349" alt="Screenshot 2024-07-01 at 2 37 02 PM" src="https://github.com/erawn/pagebreaks/assets/26943712/7b5038aa-7607-4c20-8fa1-b99535e24c19">
    </tr>
        <tr>
                  <td align="left">Exported variables become read-only, and are only accessible for later cells in the notebook</td>
             <td align="center" width="40%"><img width="377" alt="Screenshot 2024-07-01 at 11 11 27 AM" src="https://github.com/erawn/pagebreaks/assets/26943712/096f4ea1-be32-4841-bf7b-d2e8341f86f1">
    </tr>
          <tr>
                  <td align="left">To check out the current state of the notebook, you can use the <code>%who_pb</code> IPython magic:</td>
             <td align="center" width="40%"><img width="585" alt="who_pb" src="https://github.com/erawn/pagebreaks/assets/26943712/7ed8644b-fb14-41a0-b89a-eaa1a85d04be">
    </tr>
            <tr>
                  <td align="left">Modules remain global, so you only have to import them once:</td>
             <td align="center" width="40%"><img width="955" align="right" alt="packages_are_global" src="https://github.com/erawn/pagebreaks/assets/26943712/736388a9-0dc8-4efb-b4ae-0fd942b7b1f4">
</table>

<sub> *Because Python doesn't have a built-in way to ensure read-only variables, we check for redefinitions at the AST level and dynamically after each cell run, checking to see if the value has changed. </sub>

## Details

### Making a New Pagebreak

New pagebreaks are made by pressing this button: <img width="49" alt="Screenshot 2024-07-01 at 1 50 30 PM" src="https://github.com/erawn/pagebreaks/assets/26943712/bad69156-2286-475e-8ff1-9de49e9399e8"> on the "Export" cell of a pagebreak at the bottom. 

### Merging Pagebreaks
Instead of deleting Pagebreaks, you can merge the cells of a pagebreak into the one above it with this button: <img width="60" alt="Screenshot 2024-07-01 at 1 50 56 PM" src="https://github.com/erawn/pagebreaks/assets/26943712/0b9c22d8-65ea-4029-8dcc-e40d22dd7a22">

For example:

<table align="center">
    <tr>
              <td align="left">The bottom Pagebreak</td>
      <td align="center">----></td>
               <td align="left">Merges with the top</td>
    </tr>
    <tr>
       <td align="center" width="40%"><img width="384" alt="Screenshot 2024-07-01 at 1 52 36 PM" src="https://github.com/erawn/pagebreaks/assets/26943712/47d5b3fc-4ffa-4610-9df9-85715083d33c">
         <td align="center"> ----> </td>
          <td align="center" width="40%"><img width="321" alt="Screenshot 2024-07-01 at 1 52 44 PM" src="https://github.com/erawn/pagebreaks/assets/26943712/d326c980-05aa-46cc-9544-10762a93326c">
    </tr>
</table>

### %who_pb

We've added the IPython magic ```%who_pb"```, which is a pagebreaks-specific version of ```%who_ls```. ```%who_pb"``` prints out your notebook state by its pagebreak, listing whether each variable is _currently_ being exported. Pagebreaks only generates the export variables it needs for each cell, so you won't see variables that are exported in later pagebreaks, because those are currently out of scope!

### How it works

You shouldn't need to know what's going on under the hood to use Pagebreaks, but if you're curious, read on!

Rather than dynamically storing and reloading different global variables in your kernel, Pagebreaks manipulates the programs you write before they go to the compiler, changing the names of variables under the hood. For example, the variable "a" is actually stored as "pb_0_a" in the global state:

When a variable is exported to be used between cells, a new variable "pb_export_a" is generated for each cell run (as a user, you don't have to worry about any of this, you can just use the name "a" as normal!). Because Python doesn't have a way to enforce that variables are read-only at compile time, Pagebreaks will check after your cell has run that the "pb_export_a" variable still matches the original "pb_0_a" variable. If it doesn't, Pagebreaks will revert the variables in your current pagebreak back to what they were before you ran the cell. 

At the bottom of each pagebreak, the "export" footer allows variables to be exported _read-only_ (with some caveats) to all later cells:


## Requirements

- JupyterLab >= 4.0.0
- Pagebreaks is currently only available for IPython notebooks in Jupyter.

## Uninstall

To remove the extension, execute:

```bash
pip uninstall pagebreaks
```
