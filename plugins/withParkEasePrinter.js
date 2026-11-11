const { createRunOncePlugin, withMainApplication } = require('@expo/config-plugins');

function withParkEasePrinter(config) {
  return withMainApplication(config, configMod => {
    if (configMod.modResults.language !== 'kt') return configMod;
    const marker = 'add(ParkeasePrinterPackage())';
    if (!configMod.modResults.contents.includes(marker)) {
      configMod.modResults.contents = configMod.modResults.contents.replace('// Packages that cannot be autolinked yet can be added manually here, for example:', `// Packages that cannot be autolinked yet can be added manually here, for example:\n          ${marker}`);
    }
    return configMod;
  });
}

module.exports = createRunOncePlugin(withParkEasePrinter, 'with-parkease-printer', '1.0.0');
