"""Three ATS-friendly template styles (single column, real text, no images)."""
TEMPLATES = {
    "classic": dict(font="'DejaVu Serif', 'Times New Roman', Georgia, serif", size="10pt", leading="1.35",
                    margin="16mm", h1="21pt", h1_spacing="0.02em", align="center", accent="#111111",
                    rule="0.8pt solid #111",
                    docx_font="Times New Roman", docx_accent=(0x11, 0x11, 0x11), docx_center=True),
    "modern": dict(font="'DejaVu Sans', Helvetica, Arial, sans-serif", size="9.6pt", leading="1.38",
                   margin="15mm", h1="23pt", h1_spacing="-0.01em", align="left", accent="#1d4ed8",
                   rule="1.2pt solid #1d4ed8",
                   docx_font="Calibri", docx_accent=(0x1D, 0x4E, 0xD8), docx_center=False),
    "compact": dict(font="'DejaVu Sans', Arial, sans-serif", size="8.8pt", leading="1.28",
                    margin="11mm", h1="17pt", h1_spacing="0", align="left", accent="#222222",
                    rule="0.5pt solid #888",
                    docx_font="Arial", docx_accent=(0x22, 0x22, 0x22), docx_center=False),
}
