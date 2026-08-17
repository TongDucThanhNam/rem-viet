# `@agency/cms-alchemy`

Provider-neutral inputs for the Alchemy/Cloudflare reference deployment. The
package validates per-client resource names, stages, runtime bindings, origins,
and produces a callable D1/R2/Worker plan. Consumers inject their pinned Alchemy
resource factories, keeping Alchemy SDK versions outside the stable contract.
Its manifest input is a typed projection of `CmsSiteManifest`; bootstrap,
verification, and infrastructure therefore share one resource-name and origin
contract instead of maintaining a second manifest shape.
