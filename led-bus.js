/* Shared admin ↔ stage relay (SSE + POST). Works over http://localhost. */
(function (global) {
  var es = null;
  var role = "unknown";
  var handlers = { cmd: [], state: [], hello: [], status: [] };

  function emit(kind, data) {
    (handlers[kind] || []).forEach(function (fn) {
      try { fn(data); } catch (err) { console.warn("[led-bus]", err); }
    });
  }

  function on(kind, fn) {
    if (!handlers[kind]) handlers[kind] = [];
    handlers[kind].push(fn);
    return function () {
      handlers[kind] = handlers[kind].filter(function (f) { return f !== fn; });
    };
  }

  function connect(nextRole) {
    role = nextRole || role;
    if (es) {
      try { es.close(); } catch (err) { /* ignore */ }
      es = null;
    }
    if (typeof EventSource === "undefined") {
      emit("status", { linked: false, reason: "no-eventsource" });
      return;
    }
    try {
      es = new EventSource("/events?role=" + encodeURIComponent(role));
    } catch (err) {
      emit("status", { linked: false, reason: "connect-failed" });
      return;
    }
    es.addEventListener("hello", function () {
      emit("status", { linked: true, role: role });
    });
    es.addEventListener("cmd", function (e) {
      try { emit("cmd", JSON.parse(e.data)); } catch (err) { /* ignore */ }
    });
    es.addEventListener("state", function (e) {
      try { emit("state", JSON.parse(e.data)); } catch (err) { /* ignore */ }
    });
    es.onerror = function () {
      emit("status", { linked: false, reason: "sse-error" });
    };
    es.onopen = function () {
      emit("status", { linked: true, role: role });
    };
  }

  function post(path, body) {
    return fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then(function (r) { return r.json().catch(function () { return { ok: r.ok }; }); })
      .catch(function (err) { return { ok: false, error: String(err) }; });
  }

  function sendCmd(action, value) {
    return post("/cmd", {
      type: "cmd",
      action: action,
      value: value,
      from: "admin",
      t: Date.now()
    });
  }

  function publishState(state) {
    return post("/state", {
      type: "state",
      state: state,
      from: role,
      t: Date.now()
    });
  }

  global.LedBus = {
    connect: connect,
    on: on,
    sendCmd: sendCmd,
    publishState: publishState,
    post: post
  };
})(window);
