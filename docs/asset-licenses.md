# Asset and dependency provenance

| Item                                       | Origin                                                                                         | License/status                                         |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| Orca and Shark SVG silhouettes             | Original paths in `components/board/piece.tsx`, created for this project                       | Project license pending owner decision                 |
| Board geometry, surfaces, decorative marks | Original SVG/CSS; traditional topology independently reconstructed                             | Project license pending owner decision                 |
| Move/capture sounds                        | Original sine-wave synthesis using Web Audio                                                   | Project license pending owner decision                 |
| Typography                                 | Browser/system Arial, Helvetica, Georgia, Times New Roman fallbacks; no font files distributed | System-provided fonts                                  |
| Interface symbols                          | Unicode characters rendered by system fonts                                                    | No bundled artwork                                     |
| App bootstrap                              | Official create-next-app 16.3.5, configuration only                                            | MIT; upstream package license retained in dependencies |
| Runtime and development libraries          | npm packages listed in package-lock.json                                                       | Their respective upstream licenses; no ownership claim |

`public/` is fresh and contains only project-authored assets. No old-repository assets or external images/audio are present. Product source and artwork have no granted redistribution license until the owner selects one. See `LICENSE`.
