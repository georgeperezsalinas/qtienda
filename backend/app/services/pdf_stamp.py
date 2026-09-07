"""Sello de trazabilidad en productos digitales PDF.

Agrega una hoja al final del PDF comprado con el número de pedido y el
nombre de la tienda — no evita la reventa, pero deja cada copia vinculada
a la compra que la generó. No toca el contenido original del vendedor
(se agrega una hoja nueva, nunca se dibuja encima de las existentes).
"""
import io

from pypdf import PdfReader, PdfWriter
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


def stamp_pdf_with_order(pdf_bytes: bytes, order_number: str, store_name: str) -> bytes:
    try:
        reader = PdfReader(io.BytesIO(pdf_bytes))
        if len(reader.pages) == 0:
            return pdf_bytes
        last_page = reader.pages[0]
        page_size = (float(last_page.mediabox.width), float(last_page.mediabox.height))
    except Exception:
        # PDF corrupto o con un formato que pypdf no puede leer: se sirve tal
        # cual antes que bloquear una descarga ya pagada.
        return pdf_bytes

    width, height = page_size or letter

    stamp_buffer = io.BytesIO()
    c = canvas.Canvas(stamp_buffer, pagesize=(width, height))
    lines = [
        "Copia personal — no distribuir",
        f"Tienda: {store_name}",
        f"Pedido: #{order_number}",
    ]
    c.setFont("Helvetica", 11)
    line_height = 18
    y = height / 2 + (len(lines) - 1) * line_height / 2
    for line in lines:
        c.drawCentredString(width / 2, y, line)
        y -= line_height
    c.save()
    stamp_buffer.seek(0)

    try:
        stamp_page = PdfReader(stamp_buffer).pages[0]
        writer = PdfWriter()
        for page in reader.pages:
            writer.add_page(page)
        writer.add_page(stamp_page)

        out = io.BytesIO()
        writer.write(out)
        return out.getvalue()
    except Exception:
        return pdf_bytes
