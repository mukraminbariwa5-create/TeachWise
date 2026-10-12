import { Component, type ReactNode } from 'react';
import { Platform, View } from 'react-native';
import { tr } from '@/lib/i18n';
import { reportError } from '@/lib/reportError';
import { colors } from '@/theme';
import { Button } from './Button';
import { Txt } from './Txt';
import { WiseMascot } from './WiseMascot';

/**
 * If a screen crashes, show a friendly page instead of a blank app, and report the error
 * (with the screen and app version) so it can be fixed.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error) {
    reportError(error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: colors.frame, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <WiseMascot size={170} mood="worried" />
        <Txt weight="bold" size={26} color="#FFFFFF" style={{ textAlign: 'center' }}>{tr('Something went wrong', 'May nangyaring mali')}</Txt>
        <Txt size={16} color={colors.onFrameMuted} style={{ textAlign: 'center', maxWidth: 380, lineHeight: 23 }}>
          {tr('Sorry about that. The problem was reported automatically. Your saved answers are safe.', 'Pasensya na. Awtomatikong nai-report ang problema. Ligtas ang mga naka-save mong sagot.')}
        </Txt>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Button title={tr('Try again', 'Subukan ulit')} variant="light" size="lg" onPress={() => this.setState({ error: null })} />
          {Platform.OS === 'web' && <Button title={tr('Reload', 'I-reload')} variant="outline" size="lg" onPress={() => window.location.assign('/')} style={{ borderColor: '#FFFFFF' }} />}
        </View>
      </View>
    );
  }
}
