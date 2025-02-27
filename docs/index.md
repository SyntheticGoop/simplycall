---
# https://vitepress.dev/reference/default-theme-home-page
layout: home

hero:
  name: "simplycall 🤟"
  tagline: "A dead simple typed rpc implementation"

  actions:
    - theme: brand
      text: Install now
      link: "#install"
features:
  - icon: 🪶
    title: Featherweight
    details: Zero dependencies. Zero packages. Just copy the source code and get started.
  - icon: 🔓
    title: Understand
    details: Typed RPCs are not black magic. Figure out how they work and roll your own.
  - icon: 🗿
    title: Typesafe, Typerich
    details: Preserve types all the way through, even documentation.
  - icon: 🧬
    title: Endless Customization
    details: Need something extra? Just add it in! Hate the interface? Change it!
---

## How it looks like, in full detail, without redactions

_router.ts_
```ts
export const router = new Router<{ db: Database, cookies: Cookies }>()
```

_someroute.ts_
```ts
import { router } from "router"
import { ctx } from "simplycall"

const route = router
  .on("route scope")
  .with({
    /**
     * The login function
     *
     * Did you really need this documentation?
     *
     * @params username The username duh.
     * @params password Are you sure you're sending this across https?
     */
    async login(username: string, password: string) {
      const session = this[ctx].db.sessions.authorize({ username, password });
      if (session) {
        this[ctx].cookies.set("session", session.token)
        return true
      }
      return false
    },
    async logout() {
      this[ctx].db.sessions.revoke(this[ctx].session.id)
    },
    async getData() {
      return this[ctx].db.getAllTheData()
    }
  })
  .conformArgumentsThrough({
    login(username, password) {
      if (typeof username !== "string") throw Error()
      if (typeof password !== "string") throw Error()
      return [username, password]
    },
    logout: "assume typesafe",
    getData: "assume typesafe"
  })
```

_route-server.ts_
```ts
import { makeTransportFromFetch } from "simplycall/transport/http/fromFetch"
import "someroute" // All routes must be imported to ensure route registration side effect ordering

import { router } from "router"

const handler = makeTransportFromFetch(router)
export function whateverFrameworkServerYoureUsing(request: Request) {
  const result = handler.onRequestInfallibly(request)
  if ("err" in result) {
    console.error(result)
    return new Response(null, { status: 500 })
  }

  return new Response(result.ok.body, { headers: result.ok.headers })
}
```

_client.ts_
```ts
import { makeTransportThroughFetch } from "simplycall/transport/http/throughFetch"

export const client = new Client<AbortController>(makeTransportThroughFetch({
  url: "/your-mysterious-rpc-url-endpoint"
}))
```

_somewhere-on-the-client.ts_
```ts
import { typeof route as TheRoute } from "someroute"
import { client } from "client.ts"

const isLoggedIn = client<TheRoute>
  .on("route scope") // Intellisense autocompletes.
  .login("username", "password12345") // Get type hints and documentation

const controller = new AbortController()
setTimeout(() => controller.abort(), 250)
const theData = client<TheRoute>
  .on("route scope", controller)
  .getData()
```




## It's not rocket science, really.

Creating typed RPC routes is a fairly straightforward process. You just need three parts.
1. A router that takes in a route implementation and creates a matcher for each function.
2. A client that takes in a route definition and creates a typed interface for consumption.
3. A transport implementation to bridge messages between the client and the router.

This is something you can write in one afternoon.

## Install

Just run
```bash
npm install...
```

Yet another library? Screw that.

Here's the code in its full glory. To install, copy and paste it into your project.


::: details Server router and Client
<<< ../src/index.ts
:::

::: details Server transport
<<< ../src/transports/http/fromFetch.ts
:::

::: details Client transport
<<< ../src/transports/http/throughFetch.ts
:::


