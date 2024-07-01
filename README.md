# Pagebreaks : Scope Boundaries for Jupyter Notebooks

Pagebreaks is a research project exploring how notebook programming enviornments could support scope boundaries between _cells_. It is a Jupyter Notebooks extension (with a supporting IPython plugin) which creates _scope boundaries_ between groups of cells in a Jupyter Notebook, allowing cells within a pagebreak to share state as usual, but limiting 



  <table>
      <tr>
        <th>From</th>
        <th>Subject</th>
        <th>Date</th>
      </tr>
    </table>

<table align="center">
      <colgroup>
       <col span="1" style="width: 50%;">
       <col span="1" style="width: 50%;">
    </colgroup>
      <tbody>
    <tr>
            <td align="center"><img width="600" alt="showscopebound" src="https://github.com/erawn/pagebreaks/assets/26943712/d8552e7a-c151-4bb4-98a6-40e7090902a3">
        <td align="left">Each "pagebreak" keeps top-level ("global" for python) variables isolated, so that within a pagebreak you can use Jupyter notebooks normally (referencing variables between cells), but preventing those variables from being accessed (by default) in the rest of the notebook:.</td>
    </tr>
      <tr>
             <td align="center"><img width="449"  align="right" alt="showeditexport" src="https://github.com/erawn/pagebreaks/assets/26943712/0f37a240-6052-4195-836a-72d041391c73"/>
        <td align="left">To reference variables between Pagebreaks, add the variable to the "export" list at the bottom, and it will become accessible to _later_ cells in a read-only state.</td>
    </tr>
      </tbody>
</table>

<table class="mytable">
    <tr>
        <th>From</th>
        <th>Subject</th>
        <th>Date</th>
    </tr>
</table>

<style>
    .mytable td, .mytable th { width:15%; }
    .mytable td + td, .mytable th + th { width:70%; }
    .mytable td + td + td, .mytable th + th + th { width:15%; }
</style>

|   <div style="width:90px">To reference variables between Pagebreaks, add the variable to the "export" list at the bottom, and it will become accessible to _later_ cells in a read-only state. </div>  | ![export](https://github.com/erawn/pagebreaks/assets/26943712/5d63dcf1-2d01-4301-b8c4-34358cdf7723){width=800px}|
|--------------| ------------------------------|
| Each "pagebreak" keeps top-level ("global" for python) variables isolated, so that within a pagebreak you can use Jupyter notebooks normally (referencing variables between cells), but preventing those variables from being accessed (by default) in the rest of the notebook: | <img width="800" alt="showscopebound" src="https://github.com/erawn/pagebreaks/assets/26943712/d8552e7a-c151-4bb4-98a6-40e7090902a3"> |

<br clear="left"/>

Exported variables become read-only*, and are only accessible for _later_ cells in the notebook:



<br clear="left"/>

To check out the current state of the notebook, you can use the ```%who_pb"``` IPython magic:

<img width="585" align="right" alt="who_pb" src="https://github.com/erawn/pagebreaks/assets/26943712/7ed8644b-fb14-41a0-b89a-eaa1a85d04be">


Modules remain global, so you only have to import them once:

<img width="955" align="right" alt="packages_are_global" src="https://github.com/erawn/pagebreaks/assets/26943712/736388a9-0dc8-4efb-b4ae-0fd942b7b1f4">


*Because Python doesn't have a built-in way to ensure read-only variables, we check for redefinitions at the AST level and dynamically after each cell run, checking to see if the value has changed.

## Details

### Making a New Pagebreak

New pagebreaks are made by pressing this button: on the "Export" cell of a pagebreak at the bottom. 

### Merging Pagebreaks
Instead of deleting Pagebreaks, you can merge the cells of a pagebreak into the one above it with this button: 

For example:


### %who_pb

We've added the IPython magic ```%who_pb"```, which is a pagebreaks-specific version of ```%who_ls```. ```%who_pb"``` prints out your notebook state by its pagebreak, listing whether each variable is _currently_ being exported. Pagebreaks only generates the export variables it needs for each cell, so you won't see variables that are exported in later pagebreaks, because those are currently out of scope!

### Exported Variable List

A list of the currently available exported variables is in your notebook toolbar:


### How it works

You shouldn't need to know what's going on under the hood to use Pagebreaks, but if you're curious, read on!

Rather than dynamically storing and reloading different global variables in your kernel, Pagebreaks manipulates the programs you write before they go to the compiler, changing the names of variables under the hood. For example, the variable "a" is actually stored as "pb_0_a" in the global state:

When a variable is exported to be used between cells, a new variable "pb_export_a" is generated for each cell run (as a user, you don't have to worry about any of this, you can just use the name "a" as normal!). Because Python doesn't have a way to enforce that variables are read-only at compile time, Pagebreaks will check after your cell has run that the "pb_export_a" variable still matches the original "pb_0_a" variable. If it doesn't, Pagebreaks will revert the variables in your current pagebreak back to what they were before you ran the cell. 

At the bottom of each pagebreak, the "export" footer allows variables to be exported _read-only_ (with some caveats) to all later cells:

## Research

This is an ongoing research project! I (Eric Rawn) and my collaborators at UC Berkeley are currently studying how Jupyter programmers use Pagebreaks in their everyday work. If you would be interested in participating, please fill out the interest form and we'll be in contact! If you have any questions, you can email me at erawn@berkeley.edu. 


## Requirements

- JupyterLab >= 4.0.0
- Pagebreaks is currently only available for IPython notebooks in Jupyter.

## Install

To install the extension, execute:

```bash
pip install pagebreaks
```

## Uninstall

To remove the extension, execute:

```bash
pip uninstall pagebreaks
```

## Contributing

### Development install

Note: You will need NodeJS to build the extension package.

The `jlpm` command is JupyterLab's pinned version of
[yarn](https://yarnpkg.com/) that is installed with JupyterLab. You may use
`yarn` or `npm` in lieu of `jlpm` below.

```bash
# Clone the repo to your local environment
# Change directory to the pagebreaks directory
# Install package in development mode
pip install -e "."
# Link your development version of the extension with JupyterLab
jupyter labextension develop . --overwrite

jlpm # install packages

# Rebuild extension Typescript source after making changes
jlpm build
```

If issues, delete: ~/miniforge3/envs/notebook/share/jupyter/labextensions/pagebreaks/

You can watch the source directory and run JupyterLab at the same time in different terminals to watch for changes in the extension's source and automatically rebuild the extension.

```bash
# Watch the source directory in one terminal, automatically rebuilding when needed
jlpm watch
# Run JupyterLab in another terminal
jupyter lab
```

With the watch command running, every saved change will immediately be built locally and available in your running JupyterLab. Refresh JupyterLab to load the change in your browser (you may need to wait several seconds for the extension to be rebuilt).

By default, the `jlpm build` command generates the source maps for this extension to make it easier to debug using the browser dev tools. To also generate source maps for the JupyterLab core extensions, you can run the following command:

```bash
jupyter lab build --minimize=False
```

### Development uninstall

```bash
pip uninstall pagebreaks
```

In development mode, you will also need to remove the symlink created by `jupyter labextension develop`
command. To find its location, you can run `jupyter labextension list` to figure out where the `labextensions`
folder is located. Then you can remove the symlink named `pagebreaks` within that folder.

### Testing the extension

#### Frontend tests

This extension is using [Jest](https://jestjs.io/) for JavaScript code testing.

To execute them, execute:

```sh
jlpm
jlpm test
```

#### Integration tests

This extension uses [Playwright](https://playwright.dev/docs/intro) for the integration tests (aka user level tests).
More precisely, the JupyterLab helper [Galata](https://github.com/jupyterlab/jupyterlab/tree/master/galata) is used to handle testing the extension in JupyterLab.

More information are provided within the [ui-tests](./ui-tests/README.md) README.

### Packaging the extension

See [RELEASE](RELEASE.md)
