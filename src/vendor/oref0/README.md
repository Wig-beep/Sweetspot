# oref0 algorithm files

These files are copied unchanged from [oref0](https://github.com/openaps/oref0) 0.7.1 (MIT licence, see `LICENSE.txt`), except for one fix in `lib/determine-basal/determine-basal.js`: `csf` is declared with `var`, so the code also runs in strict mode.

Only the algorithm files used by `src/core/controllers/Oref0.ts` are included. The full `oref0` package also installs the OpenAPS command-line tools, whose dependencies (`request`, `json`, `network`, `share2nightscout-bridge`) have known vulnerabilities and are not needed here. The files need `lodash`, `moment` and `moment-timezone`, which are dependencies of this project.
