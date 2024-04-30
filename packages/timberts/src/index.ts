import { Timber as timber } from './Timber';
import { Cloak, Data, Effect, HTML, Init, On, Text } from './directives/index';

export const Timber = new timber()
  .directive('data', Data)
  .directive('text', Text)
  .directive('on', On)
  .directive('cloak', Cloak)
  .directive('effect', Effect)
  .directive('html', HTML)
  .directive('init', Init);

export default Timber;
