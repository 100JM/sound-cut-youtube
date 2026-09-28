const fs = require('node:fs/promises');
const path = require('node:path');
// electron-builder filters node_modules from extraResources; preserve Next's traced runtime verbatim.
module.exports = async context => {
  await fs.cp(path.join(context.packager.projectDir, '.desktop', 'server'),
    path.join(context.appOutDir, 'resources', 'server'), { recursive: true });
};
