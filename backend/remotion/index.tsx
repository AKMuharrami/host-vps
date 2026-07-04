import { registerRoot, Composition } from 'remotion';
import { CaptionsComposition } from './CaptionsComposition';

export const RemotionRoot = () => {
  return (
    <Composition
      id="Captions"
      component={CaptionsComposition}
      durationInFrames={600} // Will be overridden dynamically
      fps={60}
      width={1080}
      height={1920}
      defaultProps={{
        videoUrl: '',
        captions: [],
        styleOptions: {},
        videoHeight: 1920,
        videoWidth: 1080,
        durationInFrames: 600,
        fps: 60
      }}
      calculateMetadata={({ props }) => {
        return {
          durationInFrames: props.durationInFrames || 600,
          fps: props.fps || 60,
          width: props.videoWidth || 1080,
          height: props.videoHeight || 1920,
        };
      }}
    />
  );
};

registerRoot(RemotionRoot);
