import { ISettingRegistry } from '@jupyterlab/settingregistry';
import { JupyterFrontEndPlugin } from '@jupyterlab/application';
import { pagebreaksState } from './state';

export function settingsInit(
  settingRegistry: ISettingRegistry,
  plugin: JupyterFrontEndPlugin<void>,
  state: pagebreaksState,
  thisArg: any
) {
  settingRegistry
    .load(plugin.id)
    .then(settings => {
      console.log('pagebreaks settings loaded:', settings.composite);
      // state.setLoggingSetting(
      //     settings
      //         .get('enableLogging')
      //         .composite?.toString()
      //         .toLowerCase() === 'true' ? true : false
      // );
      // state.setActiveSetting(
      //     settings.get('enablePlugin').composite?.toString().toLowerCase() ===
      //         'true' ? true : false
      // );
    })
    .catch(reason => {
      console.error('Failed to load settings for pagebreaks.', reason);
    });
  settingRegistry.pluginChanged.connect(name => {
    settingRegistry
      .load(plugin.id)
      .then(settings => {
        // console.log('pagebreaks settings changed:', settings.composite);
        // isActiveManager.setLoggingSetting(
        //     settings
        //         .get('enableLogging')
        //         .composite?.toString()
        //         .toLowerCase() === 'true' ? true : false
        // );
        // isActiveManager.setActiveSetting(
        //     settings
        //         .get('enablePlugin')
        //         .composite?.toString()
        //         .toLowerCase() === 'true' ? true : false
        // );
      })
      .catch(reason => {
        console.error('Failed to load settings for pagebreaks.', reason);
      });
  }, thisArg);
}
