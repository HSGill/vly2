import ComingSoon from '../../../components/VTheme/ComingSoon'
import publicPage from '../../../hocs/publicPage'
import { FullPage } from '../../../components/VTheme/VTheme'

const Safe = () =>
  <FullPage>
    <h1>School Safe</h1>
    <ComingSoon />
  </FullPage>

export default publicPage(Safe)
