// Acuerdo entre autor e intérprete: condiciones, simulador de pagos, texto de la autorización y firma.
import React, { useCallback, useEffect, useState } from 'react';
import { View, Text, Pressable } from 'react-native';
import { supabase } from '../supabase';
import { Encabezado, Tarjeta, H2, P, Chico, Campo, Boton, Aviso, Cargando, Chip, Chips, Interruptor, Etiqueta } from '../ui';
import { modalidadesPago, etiquetasAcuerdo, armarTexto, textoPago, textoExclusividad, textoPlazo, numero, Simulador } from '../acuerdo';

const mesesOpciones = [6, 12, 24, 36];

function formularioInicial(a, autoresObra) {
  return {
    modalidad_pago: (a && a.modalidad_pago) || 'sin_cargo',
    monto: a && a.monto != null ? String(Math.round(a.monto)) : '',
    moneda: (a && a.moneda) || 'ARS',
    porcentaje: a && a.porcentaje != null ? String(a.porcentaje).replace('.', ',') : '',
    exclusivo: !!(a && a.exclusivo),
    exclusividad_meses: (a && a.exclusividad_meses) || 12,
    plazo_grabacion_meses: a ? a.plazo_grabacion_meses || null : 12,
    creditos: (a && a.creditos) || autoresObra || '',
    condiciones: (a && a.condiciones) || '',
  };
}

function Seleccion({ t, opciones, valor, onCambio, sufijo, conNinguno }) {
  return (
    <Chips>
      {conNinguno ? <Chip t={t} label={conNinguno} selected={!valor} onPress={() => onCambio(null)} /> : null}
      {opciones.map((m) => (
        <Chip key={m} t={t} label={m + (sufijo || '')} selected={valor === m} onPress={() => onCambio(m)} />
      ))}
    </Chips>
  );
}

export default function Acuerdo({ t, nav, uid, params, perfil }) {
  const [datos, setDatos] = useState(null);
  const [form, setForm] = useState(null);
  const [editando, setEditando] = useState(false);
  const [nombreLegal, setNombreLegal] = useState('');
  const [dni, setDni] = useState('');
  const [acepto, setAcepto] = useState(false);
  const [comentario, setComentario] = useState('');
  const [verTexto, setVerTexto] = useState(false);
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [guardando, setGuardando] = useState('');

  const cargar = useCallback(async () => {
    const [ped, ac, pl, cfg] = await Promise.all([
      supabase
        .from('pedidos')
        .select(
          '*, canciones(titulo), compositor:perfiles!pedidos_compositor_id_fkey(nombre), artista:perfiles!pedidos_artista_id_fkey(nombre)'
        )
        .eq('id', params.pedidoId)
        .maybeSingle(),
      supabase.from('acuerdos').select('*').eq('pedido_id', params.pedidoId).maybeSingle(),
      supabase.from('plantillas').select('texto').eq('id', 'autorizacion').maybeSingle(),
      supabase.from('configuracion').select('comision_inedita').eq('id', 1).maybeSingle(),
    ]);
    if (!ped.data) {
      setError('No encontramos este pedido.');
      return;
    }
    const au = await supabase.from('autores').select('nombre,rol,porcentaje').eq('cancion_id', ped.data.cancion_id);
    const autoresObra = (au.data || [])
      .map((x) => x.nombre + (x.rol === 'letra' ? ' (letra)' : x.rol === 'musica' ? ' (música)' : ' (letra y música)'))
      .join(', ');
    const d = {
      pedido: ped.data,
      acuerdo: ac.data || null,
      plantilla: pl.data ? pl.data.texto : '',
      comision: cfg.data ? Number(cfg.data.comision_inedita) : 0,
      autoresObra,
    };
    setDatos(d);
    setForm(formularioInicial(ac.data, autoresObra));
    const soyAutor = ped.data.compositor_id === uid;
    if (ac.data) {
      setNombreLegal((soyAutor ? ac.data.autor_nombre_legal : ac.data.artista_nombre_legal) || '');
      setDni((soyAutor ? ac.data.autor_dni : ac.data.artista_dni) || '');
      setComentario(ac.data.comentario_artista || '');
    }
  }, [params.pedidoId, uid]);

  useEffect(() => {
    cargar();
  }, [cargar]);

  if (!datos || !form) {
    return (
      <View style={{ gap: 16 }}>
        <Encabezado t={t} onVolver={nav.volver} titulo="Acuerdo" />
        {error ? <Aviso t={t} texto={error} /> : <Cargando t={t} />}
      </View>
    );
  }

  const { pedido, acuerdo, plantilla, comision, autoresObra } = datos;
  const soyAutor = pedido.compositor_id === uid;
  const soyArtista = pedido.artista_id === uid;
  const titulo = pedido.canciones ? pedido.canciones.titulo : 'la canción';
  const nombres = {
    autorNombre: pedido.compositor ? pedido.compositor.nombre : '',
    artistaNombre: pedido.artista ? pedido.artista.nombre : '',
    cancion: titulo,
    autoresObra,
  };

  // Lo que se muestra: si estoy editando, el formulario; si no, lo guardado
  function desdeFormulario() {
    return {
      modalidad_pago: form.modalidad_pago,
      monto: form.modalidad_pago === 'monto_fijo' || form.modalidad_pago === 'mixto' ? numero(form.monto) : null,
      moneda: form.moneda,
      porcentaje: form.modalidad_pago === 'porcentaje' || form.modalidad_pago === 'mixto' ? numero(form.porcentaje) : null,
      exclusivo: form.exclusivo,
      exclusividad_meses: form.exclusivo ? form.exclusividad_meses || null : null,
      plazo_grabacion_meses: form.plazo_grabacion_meses || null,
      creditos: form.creditos.trim() || null,
      condiciones: form.condiciones.trim() || null,
    };
  }
  const formularioAbierto = soyAutor && (!acuerdo || editando);
  const vista = formularioAbierto
    ? Object.assign({}, acuerdo || {}, desdeFormulario(), { comision_pct: acuerdo ? acuerdo.comision_pct : comision })
    : acuerdo;

  function cambiar(campo, valor) {
    setForm(Object.assign({}, form, { [campo]: valor }));
  }

  function validar(c) {
    if ((c.modalidad_pago === 'monto_fijo' || c.modalidad_pago === 'mixto') && !(c.monto > 0)) return 'Poné el monto.';
    if ((c.modalidad_pago === 'porcentaje' || c.modalidad_pago === 'mixto') && !(c.porcentaje > 0 && c.porcentaje <= 100)) {
      return 'Poné un porcentaje entre 1 y 100.';
    }
    return '';
  }

  function traducir(e) {
    const m = (e && e.message) || '';
    if (/nombre completo y DNI/i.test(m)) return 'Para firmar completá tu nombre completo y DNI.';
    if (/cerrado/i.test(m)) return 'Este acuerdo ya está cerrado.';
    if (/aceptado/i.test(m)) return 'Primero el pedido tiene que estar aceptado.';
    return 'No se pudo guardar. Probá de nuevo.';
  }

  async function guardarCondiciones() {
    setError('');
    setOk('');
    const c = desdeFormulario();
    const v = validar(c);
    if (v) return setError(v);
    setGuardando('condiciones');
    let r;
    if (acuerdo) r = await supabase.from('acuerdos').update(c).eq('id', acuerdo.id);
    else r = await supabase.from('acuerdos').insert(Object.assign({ pedido_id: pedido.id }, c));
    setGuardando('');
    if (r.error) return setError(traducir(r.error));
    setEditando(false);
    setOk(acuerdo ? 'Condiciones actualizadas. Las firmas anteriores se borraron: hay que volver a firmar.' : 'Acuerdo propuesto. Ahora firmalo vos y esperá la firma del intérprete.');
    cargar();
  }

  async function firmar() {
    setError('');
    setOk('');
    if (!nombreLegal.trim() || !dni.trim()) return setError('Completá tu nombre completo y DNI.');
    if (!acepto) return setError('Marcá que leíste y aceptás el acuerdo.');
    setGuardando('firma');
    const ahora = new Date().toISOString();
    const cambios = soyAutor
      ? { autor_nombre_legal: nombreLegal.trim(), autor_dni: dni.trim(), firmado_autor_en: ahora }
      : { artista_nombre_legal: nombreLegal.trim(), artista_dni: dni.trim(), firmado_artista_en: ahora };
    // Si con esta firma quedan las dos, se guarda el texto final
    const despues = Object.assign({}, acuerdo, cambios);
    if (despues.firmado_autor_en && despues.firmado_artista_en) {
      cambios.texto_firmado = armarTexto(plantilla, despues, nombres);
    }
    const r = await supabase.from('acuerdos').update(cambios).eq('id', acuerdo.id);
    setGuardando('');
    if (r.error) return setError(traducir(r.error));
    setAcepto(false);
    setOk(cambios.texto_firmado ? '¡Listo! El acuerdo quedó firmado por los dos.' : 'Firmaste. Falta la firma de la otra parte.');
    cargar();
  }

  async function enviarComentario() {
    setError('');
    setOk('');
    setGuardando('comentario');
    const r = await supabase.from('acuerdos').update({ comentario_artista: comentario.trim() || null }).eq('id', acuerdo.id);
    setGuardando('');
    if (r.error) return setError(traducir(r.error));
    setOk('Le dejamos tu comentario al autor.');
    cargar();
  }

  async function anular() {
    setError('');
    const r = await supabase.from('acuerdos').update({ estado: 'anulado' }).eq('id', acuerdo.id);
    if (r.error) return setError(traducir(r.error));
    cargar();
  }

  const estado = acuerdo ? acuerdo.estado : 'sin_proponer';
  const yaFirmeYo = acuerdo && (soyAutor ? acuerdo.firmado_autor_en : acuerdo.firmado_artista_en);
  const firmoOtro = acuerdo && (soyAutor ? acuerdo.firmado_artista_en : acuerdo.firmado_autor_en);
  const texto = acuerdo && acuerdo.estado === 'firmado' && acuerdo.texto_firmado ? acuerdo.texto_firmado : armarTexto(plantilla, vista || {}, nombres);

  return (
    <View style={{ gap: 18 }}>
      <Encabezado t={t} onVolver={nav.volver} titulo={'Acuerdo · ' + titulo} />
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Etiqueta t={t} text={etiquetasAcuerdo[estado]} tono={estado === 'firmado' ? 'ok' : estado === 'anulado' ? 'error' : 'aviso'} />
      </View>
      <Chico t={t}>
        Entre {nombres.autorNombre || 'el autor'} (autor) y {nombres.artistaNombre || 'el intérprete'} (intérprete). Versión de prueba:
        el texto legal todavía tiene que revisarlo un abogado.
      </Chico>

      <Aviso t={t} texto={error} />
      <Aviso t={t} texto={ok} tono="ok" />

      {/* Sin acuerdo todavía y soy el intérprete */}
      {!acuerdo && soyArtista ? (
        <Tarjeta t={t}>
          <H2 t={t}>Esperando la propuesta del autor</H2>
          <P t={t} muted>
            El autor aceptó tu pedido. Ahora tiene que proponer las condiciones: si es exclusivo, el plazo para grabar y el pago.
            Cuando lo haga, lo vas a ver acá para firmarlo.
          </P>
        </Tarjeta>
      ) : null}

      {/* Formulario de condiciones (autor) */}
      {formularioAbierto ? (
        <Tarjeta t={t}>
          <H2 t={t}>{acuerdo ? 'Editar condiciones' : 'Proponé las condiciones'}</H2>

          <Text style={{ color: t.ink, fontWeight: '700' }}>¿Cómo se paga?</Text>
          <Chips>
            {modalidadesPago.map((m) => (
              <Chip key={m.id} t={t} label={m.nombre} selected={form.modalidad_pago === m.id} onPress={() => cambiar('modalidad_pago', m.id)} />
            ))}
          </Chips>
          <Chico t={t}>{(modalidadesPago.find((m) => m.id === form.modalidad_pago) || {}).ayuda}</Chico>

          {form.modalidad_pago === 'monto_fijo' || form.modalidad_pago === 'mixto' ? (
            <View style={{ gap: 8 }}>
              <Chips>
                <Chip t={t} label="Pesos" selected={form.moneda === 'ARS'} onPress={() => cambiar('moneda', 'ARS')} />
                <Chip t={t} label="Dólares" selected={form.moneda === 'USD'} onPress={() => cambiar('moneda', 'USD')} />
              </Chips>
              <Campo
                t={t}
                label={form.modalidad_pago === 'mixto' ? 'Anticipo al firmar' : 'Monto'}
                value={form.monto}
                onChangeText={(v) => cambiar('monto', v)}
                keyboardType="number-pad"
                placeholder="Ej.: 150000"
              />
            </View>
          ) : null}
          {form.modalidad_pago === 'porcentaje' || form.modalidad_pago === 'mixto' ? (
            <Campo
              t={t}
              label="Porcentaje para el autor (%)"
              value={form.porcentaje}
              onChangeText={(v) => cambiar('porcentaje', v)}
              keyboardType="decimal-pad"
              placeholder="Ej.: 10"
              hint="Sobre lo que genere la grabación: ventas, plataformas, etc."
            />
          ) : null}

          <Interruptor
            t={t}
            label="Exclusiva"
            hint="Mientras dure, no se la das a otro intérprete."
            value={form.exclusivo}
            onValueChange={(v) => cambiar('exclusivo', v)}
          />
          {form.exclusivo ? (
            <View style={{ gap: 6 }}>
              <Text style={{ color: t.ink, fontWeight: '600' }}>¿Por cuánto tiempo?</Text>
              <Seleccion t={t} opciones={mesesOpciones} valor={form.exclusividad_meses} onCambio={(v) => cambiar('exclusividad_meses', v)} sufijo=" meses" conNinguno="Sin límite" />
            </View>
          ) : null}

          <View style={{ gap: 6 }}>
            <Text style={{ color: t.ink, fontWeight: '600' }}>Plazo para que la grabe</Text>
            <Seleccion t={t} opciones={mesesOpciones} valor={form.plazo_grabacion_meses} onCambio={(v) => cambiar('plazo_grabacion_meses', v)} sufijo=" meses" conNinguno="Sin plazo" />
            <Chico t={t}>Si no la publica en ese tiempo, la autorización se cae y la canción vuelve a estar libre.</Chico>
          </View>

          <Campo t={t} label="Cómo tiene que aparecer el crédito" value={form.creditos} onChangeText={(v) => cambiar('creditos', v)} placeholder="Ej.: Letra y música: Juan Pérez" />
          <Campo t={t} label="Otras condiciones (opcional)" value={form.condiciones} onChangeText={(v) => cambiar('condiciones', v)} multiline placeholder="Ej.: me avisás antes de publicarla" />

          <Boton t={t} variant="accent" title={acuerdo ? 'Guardar cambios' : 'Proponer acuerdo'} onPress={guardarCondiciones} loading={guardando === 'condiciones'} />
          {acuerdo ? <Boton t={t} variant="quiet" title="Cancelar" onPress={() => { setEditando(false); setForm(formularioInicial(acuerdo, autoresObra)); }} /> : null}
          {acuerdo && (acuerdo.firmado_autor_en || acuerdo.firmado_artista_en) ? (
            <Chico t={t}>Si cambiás las condiciones, se borran las firmas y hay que volver a firmar.</Chico>
          ) : null}
        </Tarjeta>
      ) : null}

      {/* Resumen de condiciones */}
      {vista && (acuerdo || formularioAbierto) && !formularioAbierto ? (
        <Tarjeta t={t}>
          <H2 t={t}>Condiciones</H2>
          <P t={t}>• {textoExclusividad(vista)}</P>
          <P t={t}>• {textoPlazo(vista)}</P>
          <P t={t}>• {textoPago(vista)}</P>
          {vista.creditos ? <P t={t}>• Crédito: {vista.creditos}</P> : null}
          {vista.condiciones ? <P t={t}>• {vista.condiciones}</P> : null}
          {soyAutor && acuerdo.estado === 'propuesto' ? (
            <Boton t={t} chico variant="outline" title="Editar condiciones" onPress={() => setEditando(true)} />
          ) : null}
        </Tarjeta>
      ) : null}

      {/* Simulador */}
      {vista && (acuerdo || formularioAbierto) ? (
        <Tarjeta t={t}>
          <H2 t={t}>Cuánto recibe cada uno</H2>
          <Simulador t={t} a={vista} />
        </Tarjeta>
      ) : null}

      {/* Comentario del intérprete */}
      {acuerdo && acuerdo.comentario_artista && soyAutor ? (
        <Tarjeta t={t}>
          <H2 t={t}>Comentario del intérprete</H2>
          <P t={t}>“{acuerdo.comentario_artista}”</P>
        </Tarjeta>
      ) : null}
      {acuerdo && soyArtista && acuerdo.estado === 'propuesto' ? (
        <Tarjeta t={t}>
          <H2 t={t}>¿Querés pedir un cambio?</H2>
          <Campo t={t} value={comentario} onChangeText={setComentario} multiline placeholder="Ej.: ¿podemos hacerlo sin exclusividad?" />
          <Boton t={t} chico variant="outline" title="Enviar comentario al autor" onPress={enviarComentario} loading={guardando === 'comentario'} />
        </Tarjeta>
      ) : null}

      {/* Texto de la autorización */}
      {acuerdo || formularioAbierto ? (
        <Tarjeta t={t}>
          <Pressable accessibilityRole="button" onPress={() => setVerTexto(!verTexto)}>
            <H2 t={t}>{(verTexto ? '▾ ' : '▸ ') + 'Texto de la autorización'}</H2>
            <Chico t={t}>{verTexto ? 'Tocá para cerrar.' : 'Tocá para leerlo completo.'}</Chico>
          </Pressable>
          {verTexto ? (
            <Text selectable style={{ color: t.ink, fontSize: 14, lineHeight: 21 }}>
              {texto}
            </Text>
          ) : null}
        </Tarjeta>
      ) : null}

      {/* Firma */}
      {acuerdo && acuerdo.estado === 'propuesto' && (soyAutor || soyArtista) && !editando ? (
        <Tarjeta t={t} style={{ borderColor: t.destacado, borderWidth: 1 }}>
          <H2 t={t}>Firma</H2>
          <Chico t={t}>
            Autor: {acuerdo.firmado_autor_en ? 'firmó ✓' : 'falta firmar'} · Intérprete: {acuerdo.firmado_artista_en ? 'firmó ✓' : 'falta firmar'}
          </Chico>
          {yaFirmeYo ? (
            <P t={t}>Ya firmaste. {firmoOtro ? '' : 'Falta la firma de la otra parte.'}</P>
          ) : (
            <View style={{ gap: 10 }}>
              <Campo t={t} label="Tu nombre completo (como en el DNI)" value={nombreLegal} onChangeText={setNombreLegal} />
              <Campo t={t} label="DNI" value={dni} onChangeText={setDni} keyboardType="number-pad" hint="Solo lo ven la otra parte y el administrador." />
              <Interruptor t={t} label="Leí el texto de la autorización y lo acepto" value={acepto} onValueChange={setAcepto} />
              <Boton t={t} variant="accent" title="Firmar acuerdo" onPress={firmar} loading={guardando === 'firma'} />
            </View>
          )}
          {soyAutor ? <Boton t={t} chico variant="quiet" title="Anular este acuerdo" onPress={anular} /> : null}
        </Tarjeta>
      ) : null}

      {acuerdo && acuerdo.estado === 'firmado' ? (
        <Tarjeta t={t}>
          <H2 t={t}>✓ Firmado por los dos</H2>
          <Chico t={t}>Queda guardado tal como se firmó. Si después cambia el modelo de autorización, este acuerdo no se modifica.</Chico>
        </Tarjeta>
      ) : null}
    </View>
  );
}
