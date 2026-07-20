/** Creates a direct-construction stub with an actionable migration error. */
function migrationStub(legacyName, replacement) {
  return class LegacyMigrationStub {
    /** @throws {Error} Always; this API needs an explicit migration. */
    constructor() {
      throw new Error(`${legacyName} is not emulated by Zx; migrate to ${replacement}`);
    }
  };
}

/** Direct Settings subclassing is intentionally outside the compatibility contract. */
export const Settings = migrationStub('gx.core.Settings', 'plain option objects');
/** Direct Container subclassing is intentionally outside the compatibility contract. */
export const Container = migrationStub('gx.ui.Container', 'zx.Component');
/** Legacy collapse animation stub. */
export const Collapse = migrationStub('gx.ui.Collapse', 'CSS transitions');
/** Legacy blend animation stub. */
export const Blend = migrationStub('gx.ui.Blend', 'CSS transitions');
/** Legacy HUD stub. */
export const Hud = migrationStub('gx.ui.Hud', 'zx.Dialog');
/** Legacy toggling helper stub. */
export const Toggling = migrationStub('gx.ui.Toggling', 'zx.Toggle');
/** Legacy horizontal group stub. */
export const HGroup = migrationStub('gx.ui.HGroup', 'CSS layout');
/** Legacy templates stub. */
export const Templates = migrationStub('gx.ui.Templates', 'native template elements');
