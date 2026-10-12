# Genera, a partir del dibujo final (branding/taikai-simbolo-final-original.png):
#  - versión con fondo transparente
#  - versión con halo claro para fondos oscuros (el cinturón negro no se pierde)
#  - tamaños para encabezado, favicon, ícono de iPhone/iPad y PWA
# Uso (desde la carpeta Kumite):  powershell -File branding/procesar-logo.ps1
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $PSScriptRoot
$origen = Join-Path $dir 'branding\taikai-simbolo-final-original.png'

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

public static class Logo {
  // Quita el fondo blanco: los bordes suavizados rojo/blanco y negro/blanco quedan semitransparentes
  public static Bitmap Transparente(string ruta) {
    Bitmap origen = new Bitmap(ruta);
    Bitmap b = new Bitmap(origen.Width, origen.Height, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(b)) g.DrawImage(origen, 0, 0, origen.Width, origen.Height);
    origen.Dispose();
    Color m = b.GetPixel(b.Width / 2, (int)(b.Height * 0.2));
    int rr = m.R, rg = m.G, rb = m.B;
    BitmapData d = b.LockBits(new Rectangle(0, 0, b.Width, b.Height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int n = Math.Abs(d.Stride) * b.Height;
    byte[] px = new byte[n];
    Marshal.Copy(d.Scan0, px, 0, n);
    for (int i = 0; i < n; i += 4) {
      int G = px[i+1], R = px[i+2];
      if (G <= rg) { px[i+3] = 255; continue; }
      double a = (255.0 - G) / (255.0 - rg);
      if (a < 0) a = 0; if (a > 1) a = 1;
      if ((R - G) > 60) { px[i] = (byte)rb; px[i+1] = (byte)rg; px[i+2] = (byte)rr; }
      else { a = (255.0 - G) / 255.0; px[i] = 0; px[i+1] = 0; px[i+2] = 0; }
      px[i+3] = (byte)Math.Round(a * 255);
    }
    Marshal.Copy(px, 0, d.Scan0, n);
    b.UnlockBits(d);
    return b;
  }

  // Dibuja la silueta del logo en blanco alrededor del logo (como un sticker)
  public static Bitmap ConHalo(Bitmap b, int radio) {
    int W = b.Width + radio * 2, H = b.Height + radio * 2;
    Bitmap sil = new Bitmap(b.Width, b.Height, PixelFormat.Format32bppArgb);
    BitmapData d = sil.LockBits(new Rectangle(0, 0, b.Width, b.Height), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
    BitmapData s = b.LockBits(new Rectangle(0, 0, b.Width, b.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
    int n = Math.Abs(d.Stride) * b.Height;
    byte[] px = new byte[n];
    Marshal.Copy(s.Scan0, px, 0, n);
    for (int i = 0; i < n; i += 4) { byte a = px[i+3]; px[i] = 245; px[i+1] = 244; px[i+2] = 240; px[i+3] = a; }
    Marshal.Copy(px, 0, d.Scan0, n);
    sil.UnlockBits(d); b.UnlockBits(s);
    Bitmap o = new Bitmap(W, H, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(o)) {
      g.Clear(Color.Transparent);
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      int pasos = 48;
      for (int k = 0; k < pasos; k++) {
        double ang = 2 * Math.PI * k / pasos;
        g.DrawImage(sil, radio + (int)Math.Round(Math.Cos(ang) * radio), radio + (int)Math.Round(Math.Sin(ang) * radio), b.Width, b.Height);
      }
      g.DrawImage(b, radio, radio, b.Width, b.Height);
    }
    sil.Dispose();
    return o;
  }

  // Guarda en un lienzo cuadrado, centrado y con margen opcional (0..0.4) y fondo opcional
  public static void Guardar(Bitmap b, string ruta, int lado, double margen, Color fondo) {
    Bitmap o = new Bitmap(lado, lado, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(o)) {
      g.Clear(fondo);
      g.InterpolationMode = InterpolationMode.HighQualityBicubic;
      g.SmoothingMode = SmoothingMode.HighQuality;
      g.PixelOffsetMode = PixelOffsetMode.HighQuality;
      double util = lado * (1 - 2 * margen);
      double esc = Math.Min(util / b.Width, util / b.Height);
      int w = (int)Math.Round(b.Width * esc), h = (int)Math.Round(b.Height * esc);
      g.DrawImage(b, (lado - w) / 2, (lado - h) / 2, w, h);
    }
    o.Save(ruta, ImageFormat.Png);
    o.Dispose();
  }
}
'@

$t = [Logo]::Transparente($origen)
$h = [Logo]::ConHalo($t, 16)
$transp = [System.Drawing.Color]::Transparent
$oscuro = [System.Drawing.Color]::FromArgb(17, 19, 24)

# versiones maestras
[Logo]::Guardar($t, "$dir\branding\taikai-simbolo-transparente.png", 1100, 0, $transp)
[Logo]::Guardar($h, "$dir\branding\taikai-simbolo-halo.png", 1100, 0, $transp)
# encabezado (claro: sin halo; oscuro: con halo)
[Logo]::Guardar($t, "$dir\src\assets\images\taikai-logo.png", 256, 0, $transp)
[Logo]::Guardar($h, "$dir\src\assets\images\taikai-logo-oscuro.png", 256, 0, $transp)
# pestaña: con halo para que se vea en barras claras y oscuras
[Logo]::Guardar($h, "$dir\public\favicon.png", 64, 0, $transp)
[Logo]::Guardar($h, "$dir\public\favicon-32.png", 32, 0, $transp)
# iPhone/iPad y PWA: sobre fondo oscuro y con margen (el sistema recorta las esquinas)
[Logo]::Guardar($h, "$dir\public\apple-touch-icon.png", 180, 0.14, $oscuro)
[Logo]::Guardar($h, "$dir\public\icon-192.png", 192, 0.16, $oscuro)
[Logo]::Guardar($h, "$dir\public\icon-512.png", 512, 0.16, $oscuro)
# marca de agua de la pantalla pública
[Logo]::Guardar($h, "$dir\src\assets\images\taikai-marca.png", 160, 0, $transp)
$t.Dispose(); $h.Dispose()
Write-Host 'OK'
