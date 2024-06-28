# Pagebreaks : Scope Boundaries for Jupyter Notebooks

Pagebreaks is a research project exploring how notebook programming enviornments could support scope boundaries between _cells_. Each "pagebreak" keeps top-level ("global" for python) variables isolated, so that within a pagebreak you can use Jupyter notebooks normally (referencing variables between cells), but preventing those variables from being accessed (by default) in the rest of the notebook:

To reference variables between Pagebreaks, add the variable to the "export" list at the bottom, and it will become accessible to _later_ cells in a read-only state. 


## Details

### Making a New Pagebreak

New pagebreaks are made by pressing this button: on the "Export" cell of a pagebreak at the bottom. 

### Merging Pagebreaks
Instead of deleting Pagebreaks, you can merge the cells of a pagebreak into the one above it with this button: 

For example:


### %who_pb

We've added the IPython magic "%who_pb", which is a pagebreaks-specific version of "%who_ls". "%who_pb" prints out your notebook state by its pagebreak, listing whether each variable is _currently_ being exported. Pagebreaks only generates the export variables it needs for each cell, so you won't see variables that are exported in later pagebreaks, because those are currently out of scope!

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
