Grepolis-Tools
===================
[www.grepinformant.com](http://www.grepinformant.com/)

## Change Log
All notable changes to this project will be documented here.

### [0.3.1] - 2016-04-02
#### Changed
- Import and api bug fixes

### [0.3.0] - 2016-04-02
#### Added
- allianceChanges api method
- Named routes and 301 redirect support
- Added handlebars and hbs templates
- Alliance intel uploader
- Multiple alliance support on activity, intel, quad pages

#### Changed
- Changed alliance activity, conquers, losses routes
- Fixed readdirRecursive not returning files in subdirectories
- Improved model/controller logic
- Full import rewrite, improved performance and import speed
- Island imports will run on 4 hour intervals

### [0.2.0] - 2016-03-14
#### Added
- Sequelize models for database interaction
- Controllers for handling routes
- Mocha for unit tests
- Winston logger for better logging
- Loggly integration
- Alliance member changes tracking on import
- Unit tests for Grepolis lib
- Unit tests for alliance endpoints
- Code linting with jshint and eslint

#### Changed
- Rewrote entire codebase using ES6
- Require node >= v5.0.0
- Cleanup of legacy/deprecated files

[0.2.0]: https://github.com/briantanner/Grepolis-Tools/compare/a4474f6...v0.2.0
[0.3.0]: https://github.com/briantanner/Grepolis-Tools/compare/v0.2.0...v0.3.0
[0.3.1]: https://github.com/briantanner/Grepolis-Tools/compare/v0.3.0...v0.3.1