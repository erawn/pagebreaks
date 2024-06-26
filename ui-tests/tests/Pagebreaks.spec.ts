import { expect, test } from '@jupyterlab/galata';
import path from 'path';

/**
 * Don't load JupyterLab webpage before running the tests.
 * This is required to ensure we capture all log messages.
 */

// import sys
// sys.path.append("/Users/erawn/pagebreaks/backend/pagebreak_ip/")
// %load_ext pagebreaks_ip
const fileName = 'basic_test.ipynb';
// test.use({ autoGoto: false });
test.describe('Notebook Tests', () => {
  // test.beforeEach(async ({ page, request, tmpPath }) => {
  //   await page.contents.uploadFile(
  //     path.resolve(__dirname, `./notebooks/${fileName}`),
  //     `${tmpPath}/${fileName}`
  //   );

  //   await page.notebook.openByPath(`${tmpPath}/${fileName}`);
  //   await page.notebook.activate(fileName);
  // });
  test('Open Basic_test and Run it', async ({ page, tmpPath }) => {
    await page.contents.uploadFile(
      path.resolve(__dirname, `./notebooks/${fileName}`),
      `${tmpPath}/${fileName}`
    );

    await page.notebook.openByPath(`${tmpPath}/${fileName}`);
    await page.notebook.activate(fileName);
    expect(await page.notebook.isOpen(fileName)).toBeTruthy();
    expect(await page.notebook.isActive(fileName)).toBeTruthy();

    await page.notebook.runCell(1); //import pagebreak_ip extension
    await page.notebook.waitForRun(1);
    await page.waitForTimeout(1000);
    await page.notebook.runCellByCell();
    await page.notebook.waitForRun(6);
    expect(await page.getByText('a = 2').count()).toBeGreaterThanOrEqual(1);
    expect(
      await page.getByText("NameError: name 'b' is not defined").count()
    ).toBeGreaterThanOrEqual(1);
  });
  // test('should set up a basic pagebreak', async ({ page }) => {
  //   await page.goto('http://localhost:8888/lab?');
  //   await page
  //     .locator('div')
  //     .filter({ hasText: /^NotebookPython 3 \(ipykernel\)$/ })
  //     .locator('img')
  //     .click();
  //   await page.getByRole('textbox').locator('div').click();

  //   await page
  //     .getByLabel('Cells')
  //     .getByRole('textbox')
  //     .fill(
  //       'import sys\nimport os\nsys.path.append("/Users/erawn/pagebreaks/backend/pagebreak_ip/")\n%load_ext pagebreaks_ip'
  //     );
  //   await page
  //     .getByTitle('Run this cell and advance')
  //     .getByRole('button')
  //     .click();
  //   await page.getByText('Run', { exact: true }).click();
  //   await page
  //     .locator('#jp-mainmenu-run')
  //     .getByText('Run All Cells', { exact: true })
  //     .click();

  //   await page.getByTitle('Make a new Pagebreak').getByRole('button').click();
  //   await page.getByRole('textbox').nth(1).fill('a = 1\nb = 1');

  //   await page
  //     .getByLabel('Raw Cell Content')
  //     .getByRole('textbox')
  //     .fill('export { a }');
  //   await page.getByRole('textbox').nth(3).fill('print("a =",a)');
  //   await page.getByRole('textbox').nth(4).fill('b');
  //   await page.getByRole('textbox').nth(4).click();
  //   await page.getByText('Run', { exact: true }).click();
  //   await page
  //     .locator('#jp-mainmenu-run')
  //     .getByText('Run All Cells', { exact: true })
  //     .click();

  //   await expect(
  //     page.getByLabel('Cells').filter({ hasText: 'a = 1' })
  //   ).toHaveCount(1);
  //   await expect(
  //     page
  //       .getByLabel('Cells')
  //       .filter({ hasText: "NameError: name 'b' is not defined" })
  //   ).toHaveCount(1);
  //   // await expect(page.getByLabel('Cells').locator('div').filter({ hasText: 'a =' }).nth(4).
  //   // await expect(page.getByLabel('Cells')).toContainText("NameError: name 'b' is not defined");
  //   // await expect(page.getByLabel('Cells')).toContainText('a = 1');
  // });
  test('should emit an activation console message', async ({ page }) => {
    const logs: string[] = [];

    page.on('console', message => {
      logs.push(message.text());
    });

    await page.goto();

    expect(
      logs.filter(s => s === 'JupyterLab extension pagebreaks is activated!')
    ).toHaveLength(1);
  });
});
