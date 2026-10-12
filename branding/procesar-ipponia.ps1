# Genera los símbolos de Ipponia a partir de los dibujos finales:
#   branding/ipponia/simbolo-cinturon-negro-original.png  (fondo blanco; para el tema claro)
#   branding/ipponia/simbolo-cinturon-blanco-original.png (fondo negro;  para el tema oscuro)
# y todos los tamaños que usa el sistema.
# Uso (desde la carpeta Kumite):  powershell -File branding/procesar-ipponia.ps1
$ErrorActionPreference = 'Stop'
$dir = Split-Path -Parent $PSScriptRoot
$ori = Join-Path $dir 'branding\ipponia'

Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @'
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;

public static class Ippo {
  // fondoBlanco=true: quita el blanco (cinturón negro). false: quita el negro (cinturón blanco).
  public static Bitmap Transparente(string ruta, bool fondoBlanco) {
    Bitmap origen = new Bitmap(ruta);
    Bitmap b = new Bitmap(origen.Width, origen.Height, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(b)) g.DrawImage(origen, 0, 0, origen.Width, origen.Height);
    origen.Dispose();
    Color m = b.GetPixel(b.Width / 2, (int)(b.Height * 0.2));
    int rr = m.R, rg = m.G, rb = m.B;
    BitmapData d = b.LockBits(new Rectangle(0, 0, b.Width, b.Height), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    int stride = Math.Abs(d.Stride), n = stride * b.Height;
    byte[] px = new byte[n];
    Marshal.Copy(d.Scan0, px, 0, n);
    int margen = 6; // la captura trae un marco fino en los bordes
    for (int y = 0; y < b.Height; y++) for (int x = 0; x < b.Width; x++) {
      int i = y * stride + x * 4;
      if (x < margen || y < margen || x >= b.Width - margen || y >= b.Height - margen) { px[i+3] = 0; continue; }
      int B = px[i], G = px[i+1], R = px[i+2];
      bool esRojo = (R - G) > 60;
      double a;
      if (fondoBlanco) {
        if (G <= rg) { px[i+3] = 255; continue; }
        a = esRojo ? (255.0 - G) / (255.0 - rg) : (255.0 - G) / 255.0;
        if (esRojo) { px[i] = (byte)rb; px[i+1] = (byte)rg; px[i+2] = (byte)rr; } else { px[i] = 0; px[i+1] = 0; px[i+2] = 0; }
      } else {
        if (esRojo) { a = R / (double)rr; px[i] = (byte)rb; px[i+1] = (byte)rg; px[i+2] = (byte)rr; }
        else { a = G / 255.0; px[i] = 255; px[i+1] = 255; px[i+2] = 255; }
      }
      if (a < 0) a = 0; if (a > 1) a = 1;
      px[i+3] = (byte)Math.Round(a * 255);
    }
    Marshal.Copy(px, 0, d.Scan0, n);
    b.UnlockBits(d);
    return Recortar(b);
  }

  // Recorta al contenido visible y lo deja en un lienzo cuadrado centrado (misma geometría en las dos versiones)
  public static Bitmap Recortar(Bitmap b) {
    int x0 = b.Width, y0 = b.Height, x1 = -1, y1 = -1;
    for (int y = 0; y < b.Height; y++) for (int x = 0; x < b.Width; x++) {
      if (b.GetPixel(x, y).A > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    }
    int w = x1 - x0 + 1, h = y1 - y0 + 1, lado = Math.Max(w, h);
    Bitmap o = new Bitmap(lado, lado, PixelFormat.Format32bppArgb);
    using (Graphics g = Graphics.FromImage(o)) {
      g.Clear(Color.Transparent);
      g.DrawImage(b, new Rectangle((lado - w) / 2, (lado - h) / 2, w, h), new Rectangle(x0, y0, w, h), GraphicsUnit.Pixel);
    }
    b.Dispose();
    return o;
  }

  // Borde claro alrededor (como un sticker), para el ícono de la pestaña
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

$negro = [Ippo]::Transparente("$ori\simbolo-cinturon-negro-original.png", $true)
$blanco = [Ippo]::Transparente("$ori\simbolo-cinturon-blanco-original.png", $false)
$negroHalo = [Ippo]::ConHalo($negro, [int]($negro.Width * 0.02))
$tr = [System.Drawing.Color]::Transparent
$oscuro = [System.Drawing.Color]::FromArgb(17, 19, 24)

# maestros
[Ippo]::Guardar($negro, "$ori\simbolo-cinturon-negro.png", 1100, 0, $tr)
[Ippo]::Guardar($blanco, "$ori\simbolo-cinturon-blanco.png", 1100, 0, $tr)
# encabezado y marca de la pantalla pública: negro para tema claro, blanco para tema oscuro
[Ippo]::Guardar($negro, "$dir\src\assets\images\ipponia-logo.png", 256, 0, $tr)
[Ippo]::Guardar($blanco, "$dir\src\assets\images\ipponia-logo-oscuro.png", 256, 0, $tr)
[Ippo]::Guardar($negro, "$dir\src\assets\images\ipponia-marca.png", 160, 0, $tr)
[Ippo]::Guardar($blanco, "$dir\src\assets\images\ipponia-marca-oscuro.png", 160, 0, $tr)
# pestaña: cinturón negro con borde claro (se ve en barras claras y oscuras)
[Ippo]::Guardar($negroHalo, "$dir\public\favicon.png", 64, 0, $tr)
[Ippo]::Guardar($negroHalo, "$dir\public\favicon-32.png", 32, 0, $tr)
# iPhone/iPad y PWA: cinturón blanco sobre fondo oscuro, con margen
[Ippo]::Guardar($blanco, "$dir\public\apple-touch-icon.png", 180, 0.14, $oscuro)
[Ippo]::Guardar($blanco, "$dir\public\icon-192.png", 192, 0.16, $oscuro)
[Ippo]::Guardar($blanco, "$dir\public\icon-512.png", 512, 0.16, $oscuro)
$negro.Dispose(); $blanco.Dispose(); $negroHalo.Dispose()
Write-Host 'OK'
