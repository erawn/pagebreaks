# Pagebreaks : Scope Boundaries for Jupyter Notebooks

Pagebreaks is a Jupyter Notebooks extension (with a supporting IPython plugin) which creates scope boundaries between groups of cells, allowing cells within a pagebreak to share state as usual, but keeping state isolated to that group. To use variables between Pagebreaks, they can be "exported" at the footer of the pagebreak in a read-only format to be used in all later cells.

The goal is to make it easier to keep variables organized in notebooks while changing as little as possible about how notebook programmers like to work. To do that, _Pagebreaks_ allows users to organize their notebook state by organizing their cells within the notebook.

## Participate in Research

My name is Eric Rawn. I’m a PhD student at UC Berkeley. To build the best system we can (and do some research along the way), we’re evaluating how our extension aids how real users program, and so we’re running a 4-6 week study with folks who use Jupyter notebooks regularly in their everyday programming. We're especially interested in how Pagebreaks might help _data science programmers_, so if that's you, we would really appreciate your insight!

The extension will log some usage data locally on your machine, which you'll send to me at the end of the study. We'll then spend about an hour chatting about your experience, the kind of work you do daily, how you use notebooks, and any other thoughts or feedback you have. Participants will be compensated for their time spent interviewing, at $30/hour, so expect $60-$90 overall. The [consent form](https://drive.google.com/file/d/1x2wYflUFg9Nwk6prcISxfZiIgD9q1Cse/view?usp=sharing) has detailed information about the study if you’re interested. I care a lot about protecting the privacy of my participants, and so a lot of the consent form (and our first chat together at the beginning of the study) is dedicated to explaining exactly what data will be collected, how it will be used, and addressing any questions or concerns.

A full open-source release will be out on PyPi after we can incorporate what we learned from the study, but you're welcome to keep using the extension after the study if you participate and find it helps you work!

**If you’re interested in participating, please fill out this [interest form](https://forms.gle/m6H27Q7y6ivFVrhJA)**

If you have any questions at all, feel free to send me an email at <erawn@berkeley.edu>, and feel free to forward this to anyone you think might be interested! Thanks!

## Install

To install the extension, execute:

```bash
python -m pip install pagebreaks
```

Then, open Jupyter Lab `jupyter lab` and open a Notebook.
You should see a warning banner telling you to run `%load_ext pagebreaksip`, at which point the warning will disappear, and you'll be good to go. (You might have to restart the kernel and reload the webpage, just to be safe)

## Overview

<table align="center">
    <tr>
              <td align="left">Each "pagebreak" keeps top-level variables isolated, so that within a pagebreak you can reference variables between cells normally, but in the rest of the notebook those variables will be inaccessible:</td>
            <td align="center" width="40%"><img width="600" alt="showscopebound" src="https://github.com/erawn/pagebreaks/assets/26943712/d8552e7a-c151-4bb4-98a6-40e7090902a3">
    </tr>
      <tr>
                <td align="left">To reference a variable defined in an earlier Pagebreak, add the variable to the “export” list at the bottom of the Pagebreak in which it was defined. Once it’s exported, later cells can read its value, but they can’t overwrite it.</td>
             <td align="center" width="30%"><img width="349" alt="Screenshot 2024-07-01 at 2 37 02 PM" src="https://github.com/erawn/pagebreaks/assets/26943712/7b5038aa-7607-4c20-8fa1-b99535e24c19">
    </tr>
        <tr>
                  <td align="left">Exported variables continue to be readable and writeable in their own Pagebreak, as usual.  After that Pagebreak, later cells can read but not write the exported variable.  Before that Pagebreak, cells can neither read nor write the exported variable.</td>
             <td align="center" width="40%"><img width="363" alt="Screenshot 2024-07-01 at 2 45 00 PM" src="https://github.com/erawn/pagebreaks/assets/26943712/a16d139a-5e24-4f0b-8999-7c759c7a09fa">
    </tr>
          <tr>
                  <td align="left">To check out the current state of the notebook, you can use the <code>%who_pb</code> IPython magic. If the magic is run in a Pagebreak in which an exported variable is available to be called (i.e. the variable is exported from a previous pagebreak, but not a later one), it will list under <code>Export Exist?</code> as <code>True</code>.</td>
             <td align="center" width="40%"><img width="585" alt="who_pb" src="https://github.com/erawn/pagebreaks/assets/26943712/7ed8644b-fb14-41a0-b89a-eaa1a85d04be">
    </tr>
            <tr>
                  <td align="left">Modules remain global, so you only have to import them once:</td>
             <td align="center" width="40%"><img width="955" align="right" alt="packages_are_global" src="https://github.com/erawn/pagebreaks/assets/26943712/736388a9-0dc8-4efb-b4ae-0fd942b7b1f4">
</table>

<sub> \*Because Python doesn't have a built-in way to ensure read-only variables, we check for redefinitions at the AST level and dynamically after each cell run, checking to see if the value has changed. </sub>

## Pagebreak Actions

### Making a New Pagebreak

New pagebreaks are made by pressing this button: <img width="49" alt="Screenshot 2024-07-01 at 1 50 30 PM" src="https://github.com/erawn/pagebreaks/assets/26943712/bad69156-2286-475e-8ff1-9de49e9399e8"> on the "Export" cell of a pagebreak at the bottom.

<img width="558" alt="makenewpb" src="https://github.com/erawn/pagebreaks/assets/26943712/7df465b9-4266-4c51-ae9a-5e1ca77b995a">

### Merging Pagebreaks

Instead of deleting Pagebreaks, you can merge the cells of a pagebreak into the one above it with:<img width="50" alt="Screenshot 2024-07-01 at 1 50 56 PM" src="https://github.com/erawn/pagebreaks/assets/26943712/0b9c22d8-65ea-4029-8dcc-e40d22dd7a22">

<img width="562" alt="mergepb" src="https://github.com/erawn/pagebreaks/assets/26943712/ccfaf0da-0c34-4f61-abe1-3d27f2638e31">

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

We've added the IPython magic `%who_pb"`, which is a pagebreaks-specific version of `%who_ls`. `%who_pb"` prints out your notebook state by its pagebreak, listing whether each variable is _currently_ being exported. Pagebreaks only generates the export variables it needs for each cell, so you won't see variables that are exported in later pagebreaks, because those are currently out of scope!

## Autoloading the IPython Plugin

To avoid having to run `%load_ext pagebreaksip` each time you start your kernel, you can start it automatically by adding:
`c.InteractiveShellApp.extensions.append('pagebreaksip')` to your `.ipython/profile/ipython_config.py` file.

## How it works

You shouldn't need to know what's going on under the hood to use Pagebreaks, but if you're curious, read on!

Rather than dynamically storing and reloading different global variables in your kernel, Pagebreaks manipulates the programs you write before they go to the interpreter, changing the names of variables under the hood.

<table align="center">
    <tr>
              <td align="left">For example, the variable <code>a</code> is actually stored as <code>pb_0_a</code> in the global state, because it is in Pagebreak <code>0</code>.</td>
      <td align="center" width="40%"><img width="274" alt="Screenshot 2024-07-01 at 2 47 14 PM" src="https://github.com/erawn/pagebreaks/assets/26943712/f1bfeb62-ccf4-4abe-b690-d4076d684e71">
    </tr>
</table>

When a variable is exported to be used between pagebreaks, a new variable <code>pb_export_b</code> is generated for each cell run (as a user, you don't have to worry about any of this, you can just use <code>a</code> and <code>b</code> as normal!). Because Python doesn't have a way to enforce that variables are read-only at compile time, Pagebreaks will check after your cell has run that the <code>pb_export_b</code> variable still matches the original <code>pb_0_b</code> variable. If it doesn't, Pagebreaks will revert the variables in your current pagebreak back to what they were before you ran the cell.

<table align="center">
    <tr>
              <td align="left">Because <code>b</code> is accessible in the second pagebreak because it's been exported, a <code>pb_export_b</code> varaible is generated for later cells to reference, preventing those cells from modifying our real <code>b</code> variable, which is <code>pb_0_b</code></td>
      <td align="center" width="40%"><img width="495" alt="Screenshot 2024-07-01 at 2 49 40 PM" src="https://github.com/erawn/pagebreaks/assets/26943712/5c2be0d1-f698-420c-a744-ee63126de5c5">
    </tr>
</table>

## Requirements

- JupyterLab >= 4.0.0
- Pagebreaks is currently only available for IPython notebooks in Jupyter.

## Uninstall

To remove the extension, execute:

```bash
pip uninstall pagebreaks
```
