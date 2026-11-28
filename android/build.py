# Buduje APK gry bez Gradle i bez bibliotek: aapt2 -> javac -> d8 -> zipalign -> apksigner.
# Użycie: python build.py [--icon ŚCIEŻKA.png] [--version 0.2] [--code 2]
# Potrzebne: JDK 17+ (JAVA_HOME) i Android SDK (ANDROID_HOME) z platforms;android-35 oraz build-tools.
# Klucz podpisu jest POZA repozytorium (domyślnie ~/ostatni-bastion-klucz). Bez niego nie da się wydać aktualizacji,
# więc trzeba mieć jego kopię zapasową i nigdy nie dodawać go do gita.
import argparse, glob, os, secrets, shutil, subprocess, sys, zipfile
from PIL import Image, ImageFilter

HERE = os.path.dirname(os.path.abspath(__file__))
DEMO = os.path.join(HERE, '..', 'demo')
BUILD = os.path.join(HERE, 'build')
WEB = ['index.html', 'assets.js', 'data.js', 'roads.js', 'game.js', 'sfx.js', 'ui.js']
MIN_SDK, TARGET_SDK = 24, 35

ap = argparse.ArgumentParser()
ap.add_argument('--icon', default=os.path.join(HERE, 'icon.png'))
ap.add_argument('--version', default='0.2')
ap.add_argument('--code', type=int, default=2)
ap.add_argument('--out', default=os.path.join(os.path.expanduser('~'), 'Downloads', 'OstatniBastion-apk'))
ap.add_argument('--keys', default=os.path.join(os.path.expanduser('~'), 'ostatni-bastion-klucz'))
args = ap.parse_args()


def need(var, probe):
    root = os.environ.get(var, '')
    if not root or not os.path.exists(os.path.join(root, probe)):
        sys.exit('Ustaw %s (brak %s w "%s")' % (var, probe, root))
    return root


JDK = need('JAVA_HOME', os.path.join('bin', 'javac.exe'))
SDK = need('ANDROID_HOME', os.path.join('platforms', 'android-%d' % TARGET_SDK, 'android.jar'))
JAR = os.path.join(SDK, 'platforms', 'android-%d' % TARGET_SDK, 'android.jar')
BT = sorted(glob.glob(os.path.join(SDK, 'build-tools', '*')))[-1]
ENV = dict(os.environ, JAVA_HOME=JDK, PATH=os.path.join(JDK, 'bin') + os.pathsep + os.environ['PATH'])


def run(*cmd):
    r = subprocess.run(list(cmd), env=ENV, capture_output=True, text=True, errors='replace')
    if r.returncode:
        sys.exit('BŁĄD: %s\n%s\n%s' % (os.path.basename(cmd[0]), r.stdout, r.stderr))
    return r.stdout


def tool(name):
    return os.path.join(BT, name)


shutil.rmtree(BUILD, ignore_errors=True)
for d in ('assets/www', 'res/values', 'classes', 'dex'):
    os.makedirs(os.path.join(BUILD, d))
for f in WEB:
    shutil.copy(os.path.join(DEMO, f), os.path.join(BUILD, 'assets', 'www', f))
open(os.path.join(BUILD, 'res', 'values', 'strings.xml'), 'w', encoding='utf-8').write(
    '<?xml version="1.0" encoding="utf-8"?>\n<resources><string name="app_name">Ostatni Bastion</string></resources>\n')

# ikona: zwykła dla starszych telefonów i adaptacyjna (system sam przycina ją do kształtu)
icon = Image.open(args.icon).convert('RGBA')
for dens, px in (('mdpi', 48), ('hdpi', 72), ('xhdpi', 96), ('xxhdpi', 144), ('xxxhdpi', 192)):
    d = os.path.join(BUILD, 'res', 'mipmap-' + dens)
    os.makedirs(d)
    m = Image.new('L', (512, 512), 0)
    from PIL import ImageDraw
    ImageDraw.Draw(m).rounded_rectangle((0, 0, 511, 511), 110, fill=255)
    flat = icon.resize((512, 512), Image.LANCZOS)
    flat.putalpha(m)
    flat.resize((px, px), Image.LANCZOS).save(os.path.join(d, 'ic_launcher.png'))
    side = px * 108 // 48
    back = icon.resize((side, side), Image.LANCZOS).filter(ImageFilter.GaussianBlur(side / 24))
    back.save(os.path.join(d, 'ic_back.png'))
    front = Image.new('RGBA', (side, side), (0, 0, 0, 0))
    inner = side * 78 // 108
    front.paste(icon.resize((inner, inner), Image.LANCZOS), ((side - inner) // 2, (side - inner) // 2))
    front.save(os.path.join(d, 'ic_front.png'))
os.makedirs(os.path.join(BUILD, 'res', 'mipmap-anydpi-v26'))
open(os.path.join(BUILD, 'res', 'mipmap-anydpi-v26', 'ic_launcher.xml'), 'w', encoding='utf-8').write(
    '<?xml version="1.0" encoding="utf-8"?>\n<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">\n'
    '    <background android:drawable="@mipmap/ic_back" />\n    <foreground android:drawable="@mipmap/ic_front" />\n</adaptive-icon>\n')

base = os.path.join(BUILD, 'base.apk')
run(tool('aapt2.exe'), 'compile', '--dir', os.path.join(BUILD, 'res'), '-o', os.path.join(BUILD, 'res.zip'))
run(tool('aapt2.exe'), 'link', '-o', base, '-I', JAR, '--manifest', os.path.join(HERE, 'AndroidManifest.xml'), '-A', os.path.join(BUILD, 'assets'),
    '--min-sdk-version', str(MIN_SDK), '--target-sdk-version', str(TARGET_SDK), '--version-code', str(args.code), '--version-name', args.version,
    os.path.join(BUILD, 'res.zip'))
sources = glob.glob(os.path.join(HERE, 'src', '**', '*.java'), recursive=True)
run(os.path.join(JDK, 'bin', 'javac.exe'), '-encoding', 'utf-8', '-Xlint:-options', '--release', '11', '-classpath', JAR, '-d', os.path.join(BUILD, 'classes'), *sources)
classes = glob.glob(os.path.join(BUILD, 'classes', '**', '*.class'), recursive=True)
run(tool('d8.bat'), '--release', '--min-api', str(MIN_SDK), '--lib', JAR, '--output', os.path.join(BUILD, 'dex'), *classes)
with zipfile.ZipFile(base, 'a', zipfile.ZIP_DEFLATED) as z:
    z.write(os.path.join(BUILD, 'dex', 'classes.dex'), 'classes.dex')
aligned = os.path.join(BUILD, 'aligned.apk')
run(tool('zipalign.exe'), '-f', '-p', '4', base, aligned)

os.makedirs(args.keys, exist_ok=True)
store, secret = os.path.join(args.keys, 'ostatni-bastion.jks'), os.path.join(args.keys, 'haslo.txt')
if not os.path.exists(store):
    if not os.path.exists(secret):
        open(secret, 'w').write(secrets.token_urlsafe(24))
    pw = open(secret).read().strip()
    run(os.path.join(JDK, 'bin', 'keytool.exe'), '-genkeypair', '-keystore', store, '-storepass', pw, '-keypass', pw, '-alias', 'bastion',
        '-keyalg', 'RSA', '-keysize', '4096', '-validity', '10000', '-dname', 'CN=mAInIAc dev')
    print('UTWORZONO NOWY KLUCZ PODPISU w', args.keys, '- zrób kopię zapasową tego folderu.')
os.makedirs(args.out, exist_ok=True)
apk = os.path.join(args.out, 'OstatniBastion-%s.apk' % args.version)
run(tool('apksigner.bat'), 'sign', '--ks', store, '--ks-pass', 'file:' + secret, '--ks-key-alias', 'bastion', '--out', apk, aligned)
print(run(tool('apksigner.bat'), 'verify', '--verbose', apk).split('\n')[0])
info = run(tool('aapt2.exe'), 'dump', 'badging', apk)
print('\n'.join(l for l in info.split('\n') if l.startswith(('package:', 'sdkVersion', 'targetSdkVersion', 'uses-permission', 'application-label:', 'launchable-activity'))))
print('APK: %s (%.1f MB)' % (apk, os.path.getsize(apk) / 1024 / 1024))
