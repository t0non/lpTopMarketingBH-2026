import os

pixel_code = """
  <!-- Meta Pixel Code -->
  <script>
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');
  fbq('init', '1692092285198949');
  fbq('track', 'PageView');
  </script>
  <noscript><img height="1" width="1" style="display:none"
  src="https://www.facebook.com/tr?id=1692092285198949&ev=PageView&noscript=1"
  /></noscript>
  <!-- End Meta Pixel Code -->
</head>
"""

def fix_file(path, is_oferta=False):
    with open(path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Adicionar tracking script
    content = content.replace('<head>', '<head><script src="/js/tracking.js"></script>')
    
    # Se for oferta, consertar a base url que mudou de oferta-497 para oferta
    if is_oferta:
        content = content.replace('<base href="/oferta-497/" />', '<base href="/oferta/" />')

    # Adicionar o Pixel
    content = content.replace('</head>', pixel_code)

    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

fix_file('index.html', is_oferta=False)
fix_file('oferta/index.html', is_oferta=True)

print("Fixed!")
