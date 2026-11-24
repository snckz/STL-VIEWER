import struct, math
import os; os.chdir(os.path.dirname(os.path.abspath(__file__)))
def cube(s=20):
    v=[(0,0,0),(s,0,0),(s,s,0),(0,s,0),(0,0,s),(s,0,s),(s,s,s),(0,s,s)]
    f=[(0,2,1),(0,3,2),(4,5,6),(4,6,7),(0,1,5),(0,5,4),(1,2,6),(1,6,5),(2,3,7),(2,7,6),(3,0,4),(3,4,7)]
    return [[v[a],v[b],v[c]] for a,b,c in f]
def write_bin(path,tris,hdr=b"Testwuerfel 20mm"):
    with open(path,"wb") as fh:
        fh.write(hdr.ljust(80,b"\0")); fh.write(struct.pack("<I",len(tris)))
        for t in tris: fh.write(struct.pack("<12fH",0,0,0,*t[0],*t[1],*t[2],0))
def write_ascii(path,tris):
    with open(path,"w") as fh:
        fh.write("solid asciiwuerfel\n")
        for t in tris:
            fh.write(" facet normal 0 0 0\n  outer loop\n")
            for p in t: fh.write("   vertex %g %g %g\n"%p)
            fh.write("  endloop\n endfacet\n")
        fh.write("endsolid asciiwuerfel\n")
c=cube(); write_bin("cube20.stl",c); write_ascii("cube_ascii.stl",c); write_bin("open.stl",c[:-2],b"offen")
# grosser Zylinder 300mm hoch (passt nicht)
tris=[]; n=64; r=30; h=300
for i in range(n):
    a=2*math.pi*i/n; b=2*math.pi*(i+1)/n
    p0=(r*math.cos(a),r*math.sin(a)); p1=(r*math.cos(b),r*math.sin(b))
    tris+= [[(0,0,0),(p1[0],p1[1],0),(p0[0],p0[1],0)],[(0,0,h),(p0[0],p0[1],h),(p1[0],p1[1],h)],
            [(p0[0],p0[1],0),(p1[0],p1[1],0),(p1[0],p1[1],h)],[(p0[0],p0[1],0),(p1[0],p1[1],h),(p0[0],p0[1],h)]]
write_bin("tall.stl",tris)
open("cube.obj","w").write("v 0 0 0\nv 10 0 0\nv 10 10 0\nv 0 10 0\nv 0 0 10\nv 10 0 10\nv 10 10 10\nv 0 10 10\nf 1 3 2\nf 1 4 3\nf 5 6 7 8\nf 1 2 6 5\nf 2 3 7 6\nf 3 4 8 7\nf 4 1 5 8\n")
open("garbage.stl","wb").write(b"\x89PNG not an stl"*20)

# ---------- 3MF ----------
import zipfile
CT = '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>'
RELS = '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>'
def mesh_xml(s=20):
    v=[(0,0,0),(s,0,0),(s,s,0),(0,s,0),(0,0,s),(s,0,s),(s,s,s),(0,s,s)]
    f=[(0,2,1),(0,3,2),(4,5,6),(4,6,7),(0,1,5),(0,5,4),(1,2,6),(1,6,5),(2,3,7),(2,7,6),(3,0,4),(3,4,7)]
    return '<mesh><vertices>'+''.join(f'<vertex x="{a}" y="{b}" z="{c}"/>' for a,b,c in v)+'</vertices><triangles>'+''.join(f'<triangle v1="{a}" v2="{b}" v3="{c}"/>' for a,b,c in f)+'</triangles></mesh>'
NS='xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02"'
def write3mf(path, files, comp=zipfile.ZIP_DEFLATED):
    with zipfile.ZipFile(path,'w',comp) as z:
        z.writestr('[Content_Types].xml',CT); z.writestr('_rels/.rels',RELS)
        for n,c in files.items(): z.writestr(n,c)
write3mf('cube.3mf',{'3D/3dmodel.model':f'<?xml version="1.0"?><model unit="millimeter" {NS}><metadata name="Application">PrusaSlicer-2.8</metadata><resources><object id="1" type="model">{mesh_xml()}</object></resources><build><item objectid="1" transform="1 0 0 0 1 0 0 0 1 128 128 0"/></build></model>'})
# Bambu-Stil: Unterbaugruppe in eigener Datei, zwei Kopien auf der Platte
write3mf('bambu.3mf',{
 '3D/3dmodel.model':f'<?xml version="1.0"?><model unit="millimeter" {NS} xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06" requiredextensions="p"><metadata name="Application">BambuStudio-02.03</metadata><resources><object id="2" p:UUID="x" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0"/></components></object></resources><build><item objectid="2" transform="1 0 0 0 1 0 0 0 1 100 128 0" printable="1"/><item objectid="2" transform="0 1 0 -1 0 0 0 0 1 150 128 0" printable="1"/></build></model>',
 '3D/Objects/object_1.model':f'<?xml version="1.0"?><model unit="millimeter" {NS}><resources><object id="1" type="model">{mesh_xml()}</object></resources><build/></model>'})
write3mf('inch.3mf',{'3D/3dmodel.model':f'<model unit="inch" {NS}><resources><object id="1">{mesh_xml(1)}</object></resources><build><item objectid="1"/></build></model>'}, zipfile.ZIP_STORED)
with zipfile.ZipFile('sliced.3mf','w',zipfile.ZIP_DEFLATED) as z:
    z.writestr('[Content_Types].xml',CT); z.writestr('Metadata/plate_1.gcode',';gcode')

# ---------- PLY ----------
V=[(0,0,0),(10,0,0),(10,10,0),(0,10,0),(0,0,10),(10,0,10),(10,10,10),(0,10,10)]
Q=[(0,3,2,1),(4,5,6,7),(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7)]
with open('cube_ascii.ply','w') as f:
    f.write('ply\nformat ascii 1.0\ncomment Scanner-Test\nelement vertex 8\nproperty float x\nproperty float y\nproperty float z\nelement face 6\nproperty list uchar int vertex_indices\nend_header\n')
    for v in V: f.write('%g %g %g\n'%v)
    for q in Q: f.write('4 %d %d %d %d\n'%q)
def binply(path, endian):
    e='<' if endian=='little' else '>'
    hdr=(f'ply\nformat binary_{endian}_endian 1.0\nelement vertex 8\nproperty float x\nproperty float y\nproperty float z\nproperty float nx\nproperty float ny\nproperty float nz\nproperty uchar red\nproperty uchar green\nproperty uchar blue\n'
         'element face 12\nproperty list uchar int vertex_indices\nproperty uchar flags\nelement edge 1\nproperty int vertex1\nproperty int vertex2\nend_header\n').encode()
    body=b''.join(struct.pack(e+'6f3B',*v,0,0,1,255,0,0) for v in V)
    for q in Q: body+=struct.pack(e+'B3iB',3,q[0],q[1],q[2],0)+struct.pack(e+'B3iB',3,q[0],q[2],q[3],0)
    body+=struct.pack(e+'2i',0,1)
    open(path,'wb').write(hdr+body)
binply('cube_le.ply','little'); binply('cube_be.ply','big')
open('cloud.ply','w').write('ply\nformat ascii 1.0\nelement vertex 3\nproperty float x\nproperty float y\nproperty float z\nend_header\n0 0 0\n1 0 0\n0 1 0\n')

# ZIP mit Unterordnern für die ZIP-Auswahl
import zipfile, os
_d = os.path.dirname(os.path.abspath(__file__))
with zipfile.ZipFile(os.path.join(_d, "folders.zip"), "w", zipfile.ZIP_DEFLATED) as z:
    z.write(os.path.join(_d, "cube20.stl"), "Projekt/Gehäuse/Deckel.stl")
    z.write(os.path.join(_d, "cube_ascii.stl"), "Projekt/Gehäuse/Boden.stl")
    z.write(os.path.join(_d, "cube.obj"), "Projekt/Halter/Halter.obj")
    z.write(os.path.join(_d, "cube_le.ply"), "Projekt/Schraube.ply")
    z.writestr("Projekt/liesmich.txt", "kein Modell")

# Platte 40 × 40 × 10 mm mit Durchgangsbohrung ⌀ 8 mm in der Mitte (geschlossenes Netz) – zum Testen des Einrastens
import math, struct
def plate_hole(path, W=40.0, H=10.0, R=4.0, N=48):
    tris = []
    ang = [i * 2 * math.pi / N for i in range(N)]
    circ = [(R * math.cos(a), R * math.sin(a)) for a in ang]
    def sq(a):   # Strahl aus der Mitte schneidet das Quadrat
        c, s = math.cos(a), math.sin(a); t = (W / 2) / max(abs(c), abs(s)); return (c * t, s * t)
    box = [sq(a) for a in ang]
    for i in range(N):
        j = (i + 1) % N
        c0, c1, b0, b1 = circ[i], circ[j], box[i], box[j]
        for z, up in ((H, True), (0.0, False)):   # Ober- und Unterseite
            q = [(c0[0], c0[1], z), (b0[0], b0[1], z), (b1[0], b1[1], z), (c1[0], c1[1], z)]
            if up: tris += [(q[0], q[1], q[2]), (q[0], q[2], q[3])]
            else: tris += [(q[0], q[2], q[1]), (q[0], q[3], q[2])]
        # Außenwand und Bohrungswand
        tris += [((b0[0], b0[1], 0), (b1[0], b1[1], 0), (b1[0], b1[1], H)), ((b0[0], b0[1], 0), (b1[0], b1[1], H), (b0[0], b0[1], H))]
        tris += [((c0[0], c0[1], 0), (c1[0], c1[1], H), (c1[0], c1[1], 0)), ((c0[0], c0[1], 0), (c0[0], c0[1], H), (c1[0], c1[1], H))]
    with open(path, "wb") as f:
        f.write(b"plate with hole".ljust(80, b" ")); f.write(struct.pack("<I", len(tris)))
        for t in tris: f.write(struct.pack("<3f", 0, 0, 0)); [f.write(struct.pack("<3f", *v)) for v in t]; f.write(b"\0\0")
plate_hole(os.path.join(_d, "plate_hole.stl"))

# 3MF im Stil von Bambu Studio: zwei Objekte (Unterdatei + Komponenten), Lage per Transformation, Namen in model_settings.config
def box_mesh(oid, w, d, h):
    v = [(x, y, z) for z in (0, h) for y in (0, d) for x in (0, w)]
    t = [(0,2,1),(1,2,3),(4,5,6),(5,7,6),(0,1,4),(1,5,4),(2,6,3),(3,6,7),(0,4,2),(2,4,6),(1,3,5),(3,7,5)]
    vs = "".join('<vertex x="%g" y="%g" z="%g"/>' % p for p in v); ts = "".join('<triangle v1="%d" v2="%d" v3="%d"/>' % q for q in t)
    return '<object id="%d" type="model"><mesh><vertices>%s</vertices><triangles>%s</triangles></mesh></object>' % (oid, vs, ts)
def bambu_3mf(path):
    ns = 'xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:p="http://schemas.microsoft.com/3dmanufacturing/production/2015/06"'
    sub = '<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" %s><resources>%s%s</resources><build/></model>' % (ns, box_mesh(1, 20, 20, 20), box_mesh(2, 10, 30, 5))
    root = ('<?xml version="1.0" encoding="UTF-8"?><model unit="millimeter" %s requiredextensions="p"><metadata name="Application">BambuStudio-02.04.00.70</metadata><resources>'
            '<object id="3" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="1" transform="1 0 0 0 1 0 0 0 1 0 0 0"/></components></object>'
            '<object id="4" type="model"><components><component p:path="/3D/Objects/object_1.model" objectid="2" transform="1 0 0 0 1 0 0 0 1 0 0 0"/></components></object>'
            '</resources><build><item objectid="3" transform="1 0 0 0 1 0 0 0 1 100 100 0" printable="1"/><item objectid="4" transform="1 0 0 0 1 0 0 0 1 140 100 0" printable="1"/></build></model>') % ns
    cfg = ('<?xml version="1.0" encoding="UTF-8"?><config><object id="3"><metadata key="name" value="Deckel"/><part id="1" subtype="normal_part"><metadata key="name" value="Deckel-Körper"/></part></object>'
           '<object id="4"><metadata key="name" value="Halter &amp; Clip"/></object><plate><metadata key="plater_id" value="1"/></plate></config>')
    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        z.writestr("[Content_Types].xml", '<?xml version="1.0" encoding="UTF-8"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>')
        z.writestr("_rels/.rels", '<?xml version="1.0" encoding="UTF-8"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
        z.writestr("3D/3dmodel.model", root); z.writestr("3D/Objects/object_1.model", sub); z.writestr("Metadata/model_settings.config", cfg)
bambu_3mf(os.path.join(_d, "bambu_two.3mf"))
