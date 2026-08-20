// test/build.test.js
import { test } from "node:test";
import assert from "node:assert/strict";
import { construir } from "../build.mjs";

test("el html generado es autocontenido", () => {
  const html = construir();
  assert.ok(html.includes('<meta charset="utf-8">'));
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

test("el bundle lleva el calculo de la Pascua antes de los festivos", () => {
  const html = construir();
  assert.ok(html.includes("domingoDePascua"), "falta el modulo de Pascua");
  assert.ok(
    html.indexOf("function domingoDePascua") < html.indexOf("function festivosDerivados"),
    "pascua.js debe ir antes que festivos.js");
});

test("el bundle no lleva datos personales", () => {
  const html = construir();
  assert.ok(!html.includes("1256.05"), "no puede llevar netos de nominas reales");
  assert.ok(!html.includes("484.83"), "no puede llevar brutos de nominas reales");
  assert.ok(!html.includes("2026-05-27"), "no puede llevar la fecha de inicio de nadie");
  assert.ok(!html.includes("Fuensanta"), "no puede llevar festivos locales de un municipio");
});

test("cada modulo importado esta en el bundle", () => {
  const html = construir();
  for (const simbolo of ["festivosDerivados", "calendarioDe", "clasificarDia",
    "RETRIBUCIONES_ANEXO", "migrarV5", "estadoInicial", "calcularGuardia", "resumenMes"]) {
    assert.ok(html.includes(simbolo), `falta ${simbolo}`);
  }
});
