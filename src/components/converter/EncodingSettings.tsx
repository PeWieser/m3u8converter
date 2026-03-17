import { useState } from 'react';
import { Settings2, Video, Music, ChevronDown, ChevronUp } from 'lucide-react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import {
  type EncodingSettings as EncodingSettingsType,
  VIDEO_CODECS, FRAMERATES, RESOLUTIONS, ASPECT_RATIOS, VIDEO_BITRATES,
  H264_PROFILES, H264_LEVELS, GOP_SIZES, B_FRAMES,
  AUDIO_CODECS, SAMPLE_RATES, AUDIO_CHANNELS, AUDIO_BITRATES,
} from '@/types/encoding';

interface Props {
  settings: EncodingSettingsType;
  onChange: (settings: EncodingSettingsType) => void;
  disabled?: boolean;
}

function SelectField({ label, value, options, onChange, disabled }: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        className="w-full h-9 rounded-md border border-border/50 bg-secondary/50 px-3 text-sm disabled:opacity-50"
      >
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </div>
  );
}

export function EncodingSettings({ settings, onChange, disabled }: Props) {
  const [expanded, setExpanded] = useState(settings.enabled);

  const update = (partial: Partial<EncodingSettingsType>) => {
    onChange({ ...settings, ...partial });
  };

  const isH264 = settings.videoCodec === 'libx264';
  const isH264OrH265 = settings.videoCodec === 'libx264' || settings.videoCodec === 'libx265';
  const isVideoCopy = settings.videoCodec === 'copy';
  const isAudioCopy = settings.audioCodec === 'copy';
  const isCustomRes = settings.resolution === 'custom';

  return (
    <div className="glass rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Settings2 className="h-5 w-5 text-primary" />
          Konvertierung
        </h3>
        <div className="flex items-center gap-3">
          <span className="text-sm text-muted-foreground">
            {settings.enabled ? 'Konvertieren + Metadaten' : 'Nur Metadaten einbetten'}
          </span>
          <Switch
            checked={settings.enabled}
            onCheckedChange={(v) => {
              update({ enabled: v });
              if (v) setExpanded(true);
            }}
            disabled={disabled}
          />
        </div>
      </div>

      {settings.enabled && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            Encoding-Einstellungen {expanded ? 'ausblenden' : 'anzeigen'}
          </button>

          {expanded && (
            <div className="space-y-6">
              {/* Video Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Video className="h-4 w-4 text-primary" />
                  Video
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Videocodec"
                    value={settings.videoCodec}
                    options={VIDEO_CODECS}
                    onChange={(v) => update({ videoCodec: v })}
                    disabled={disabled}
                  />
                  <SelectField
                    label="Bildrate"
                    value={settings.framerate}
                    options={FRAMERATES}
                    onChange={(v) => update({ framerate: v })}
                    disabled={disabled || isVideoCopy}
                  />
                  <SelectField
                    label="Auflösung"
                    value={settings.resolution}
                    options={RESOLUTIONS}
                    onChange={(v) => update({ resolution: v })}
                    disabled={disabled || isVideoCopy}
                  />
                  <SelectField
                    label="Seitenverhältnis"
                    value={settings.aspectRatio}
                    options={ASPECT_RATIOS}
                    onChange={(v) => update({ aspectRatio: v })}
                    disabled={disabled || isVideoCopy}
                  />
                </div>

                {/* Custom resolution */}
                {isCustomRes && !isVideoCopy && (
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Breite (px)</Label>
                      <Input
                        type="number"
                        value={settings.customWidth || ''}
                        onChange={(e) => update({ customWidth: parseInt(e.target.value) || undefined })}
                        placeholder="z.B. 1920"
                        className="bg-secondary/50 border-border/50 h-9"
                        disabled={disabled}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">Höhe (px)</Label>
                      <Input
                        type="number"
                        value={settings.customHeight || ''}
                        onChange={(e) => update({ customHeight: parseInt(e.target.value) || undefined })}
                        placeholder="z.B. 1080"
                        className="bg-secondary/50 border-border/50 h-9"
                        disabled={disabled}
                      />
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Video-Bitrate"
                    value={settings.videoBitrate}
                    options={VIDEO_BITRATES}
                    onChange={(v) => update({ videoBitrate: v })}
                    disabled={disabled || isVideoCopy}
                  />
                  {isH264OrH265 && (
                    <SelectField
                      label="Profil"
                      value={settings.h264Profile}
                      options={H264_PROFILES}
                      onChange={(v) => update({ h264Profile: v })}
                      disabled={disabled}
                    />
                  )}
                </div>

                {isH264 && (
                  <div className="grid grid-cols-3 gap-3">
                    <SelectField
                      label="Level"
                      value={settings.h264Level}
                      options={H264_LEVELS}
                      onChange={(v) => update({ h264Level: v })}
                      disabled={disabled}
                    />
                    <SelectField
                      label="GOP-Größe"
                      value={settings.gopSize}
                      options={GOP_SIZES}
                      onChange={(v) => update({ gopSize: v })}
                      disabled={disabled}
                    />
                    <SelectField
                      label="B-Frames"
                      value={settings.bFrames}
                      options={B_FRAMES}
                      onChange={(v) => update({ bFrames: v })}
                      disabled={disabled}
                    />
                  </div>
                )}

                {!isH264 && !isVideoCopy && (
                  <div className="grid grid-cols-2 gap-3">
                    <SelectField
                      label="GOP-Größe"
                      value={settings.gopSize}
                      options={GOP_SIZES}
                      onChange={(v) => update({ gopSize: v })}
                      disabled={disabled}
                    />
                    <SelectField
                      label="B-Frames"
                      value={settings.bFrames}
                      options={B_FRAMES}
                      onChange={(v) => update({ bFrames: v })}
                      disabled={disabled}
                    />
                  </div>
                )}
              </div>

              {/* Audio Settings */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium flex items-center gap-2">
                  <Music className="h-4 w-4 text-primary" />
                  Audio
                </h4>
                <div className="grid grid-cols-2 gap-3">
                  <SelectField
                    label="Audiocodec"
                    value={settings.audioCodec}
                    options={AUDIO_CODECS}
                    onChange={(v) => update({ audioCodec: v })}
                    disabled={disabled}
                  />
                  <SelectField
                    label="Abtastrate"
                    value={settings.sampleRate}
                    options={SAMPLE_RATES}
                    onChange={(v) => update({ sampleRate: v })}
                    disabled={disabled || isAudioCopy}
                  />
                  <SelectField
                    label="Audiokanäle"
                    value={settings.audioChannels}
                    options={AUDIO_CHANNELS}
                    onChange={(v) => update({ audioChannels: v })}
                    disabled={disabled || isAudioCopy}
                  />
                  <SelectField
                    label="Audio-Bitrate"
                    value={settings.audioBitrate}
                    options={AUDIO_BITRATES}
                    onChange={(v) => update({ audioBitrate: v })}
                    disabled={disabled || isAudioCopy}
                  />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
