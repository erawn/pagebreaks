import { ReactWidget } from '@jupyterlab/ui-components';
import { pluginStatus } from './types';

export class PluginStatusHeader extends ReactWidget {
  constructor() {
    super();
    this.addClass('jp-pb-pluginstatus-header');
    this.id = 'pagebreaks-plugin-status-header';
  }

  updateHeader(status: pluginStatus) {
    if (status === 'active' || status === 'unset') {
      this.setHidden(true);
    } else {
      this.setHidden(false);
    }
  }

  render() {
    return (
      <>
        <span className="jp-pb-pluginstatus-maintext">
          Pagebreaks IPython Plugin Inactive!
        </span>
        <br></br>
        <span className="jp-pb-pluginstatus-bottomtext">
          Run '%load_ext pagebreaksip' to load
        </span>
      </>
    );
  }
}
