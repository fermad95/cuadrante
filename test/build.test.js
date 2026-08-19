// test/build.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { construir } from "../build.mjs";

test("el html generado es autocontenido", () => {
  const html = construir();
  assert.ok(html.includes("<title>cuadrante</title>"));
  assert.ok(html.includes("14.07"), "debe llevar las tarifas dentro");
  assert.ok(!html.includes("import "), "no puede quedar ningun import");
  assert.ok(!html.match(/^export /m), "no puede quedar ningun export");
  assert.ok(!html.includes("src=\"http"), "no puede pedir nada por red");
  assert.ok(!html.includes("<link"), "el css va inlineado");
});

test("el html arranca la app", () => {
  assert.ok(construir().includes("iniciar(document.body, localStorage)"));
});
