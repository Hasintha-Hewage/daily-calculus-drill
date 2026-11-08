import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';

interface MathRendererProps {
  latex: string;
  fontSize?: number;
  color?: string;
  backgroundColor?: string;
  height?: number;
  compact?: boolean;
}

/**
 * Converts LaTeX strings into clean Unicode mathematical notation as an instant
 * offline/web fallback when WebView is unavailable or loading.
 */
export function latexToReadableUnicode(latex: string): string {
  return latex
    .replace(/\\frac\{d\}\{dx\}\\left\[(.*?)\\right\]/g, 'd/dx [ $1 ]')
    .replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '($1)/($2)')
    .replace(/\\int/g, '∫')
    .replace(/\\,/g, ' ')
    .replace(/\\cdot/g, '·')
    .replace(/\\sqrt\{([^{}]+)\}/g, '√($1)')
    .replace(/\\pi/g, 'π')
    .replace(/\\sin/g, 'sin')
    .replace(/\\cos/g, 'cos')
    .replace(/\\tan/g, 'tan')
    .replace(/\\sec/g, 'sec')
    .replace(/\\cot/g, 'cot')
    .replace(/\\ln/g, 'ln')
    .replace(/\\left/g, '')
    .replace(/\\right/g, '')
    .replace(/\^\{([^{}]+)\}/g, '^($1)')
    .replace(/\\text\{([^{}]+)\}/g, '$1');
}

/**
 * Renders LaTeX equations with crisp typography using KaTeX inside a lightweight WebView
 * on iOS/Android, with an automatic fallback for Web or offline environments.
 */
export const MathRenderer: React.FC<MathRendererProps> = ({
  latex,
  fontSize = 26,
  color = '#F8FAFC',
  backgroundColor = 'transparent',
  height = 84,
  compact = false,
}) => {
  const htmlContent = useMemo(() => {
    const escapedLatex = JSON.stringify(latex);
    const fallbackText = latexToReadableUnicode(latex)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
          <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" />
          <script defer src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js"></script>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            html, body {
              width: 100%;
              height: 100%;
              background-color: ${backgroundColor};
              color: ${color};
              display: flex;
              align-items: center;
              justify-content: ${compact ? 'flex-start' : 'center'};
              overflow-x: auto;
              overflow-y: hidden;
              font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, serif;
            }
            #math-root {
              font-size: ${fontSize}px;
              padding: ${compact ? '2px 0' : '8px 12px'};
              white-space: nowrap;
              letter-spacing: 0.5px;
            }
          </style>
        </head>
        <body>
          <div id="math-root">${fallbackText}</div>
          <script>
            function renderLatex() {
              if (window.katex) {
                try {
                  window.katex.render(${escapedLatex}, document.getElementById('math-root'), {
                    displayMode: ${!compact},
                    throwOnError: false
                  });
                } catch (err) {}
              } else {
                setTimeout(renderLatex, 50);
              }
            }
            document.addEventListener('DOMContentLoaded', renderLatex);
            renderLatex();
          </script>
        </body>
      </html>
    `;
  }, [latex, fontSize, color, backgroundColor, compact]);

  if (Platform.OS === 'web') {
    return (
      <View style={[styles.webContainer, { height, backgroundColor }]}>
        <Text style={[styles.fallbackText, { fontSize, color }]}>
          {latexToReadableUnicode(latex)}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { height, backgroundColor }]}>
      <WebView
        originWhitelist={['*']}
        source={{ html: htmlContent }}
        style={styles.webview}
        scrollEnabled={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        javaScriptEnabled={true}
        transparent={true}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    width: '100%',
    overflow: 'hidden',
    justifyContent: 'center',
  },
  webview: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  webContainer: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  fallbackText: {
    fontWeight: '600',
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
  },
});
