import { Button } from 'antd'
import Link from 'next/link'
import { Helmet } from 'react-helmet'
import { FormattedMessage } from 'react-intl'
import OrgList from '../../components/Org/OrgList'
import { FullPage, PageBanner, PageBannerButtons } from '../../components/VTheme/VTheme'
import publicPage from '../../hocs/publicPage'
import reduxApi, { withOrgs } from '../../lib/redux/reduxApi.js'

export const OrgListPage = ({ organisations, me }) => {
  const orgs = organisations.data
  const isAdmin = (me && me.role.includes('admin'))
  return (
    <FullPage>
      <Helmet>
        <title>Organisations / Voluntarily</title>
      </Helmet>
      <PageBanner>
        <h1>
          <FormattedMessage
            defaultMessage='Organisations'
            id='org.list.heading'
          />
        </h1>
        <PageBannerButtons>
          {isAdmin &&
            <Button type='primary' size='large' shape='round'>
              <Link href='/org/new'>
                <a>
                  <FormattedMessage id='org.new' defaultMessage='New Organisation' description='Button to create a new organisation' />
                </a>
              </Link>
            </Button>}
        </PageBannerButtons>
        <FormattedMessage
          defaultMessage='Check out organisations doing social good on the Voluntarily platform'
          id='org.list.subtitle'
        />
      </PageBanner>
      <OrgList orgs={orgs} />
    </FullPage>)
}

OrgListPage.getInitialProps = async ({ store, query }) => {
  const select = { p: 'name imgUrl category' }
  return store.dispatch(reduxApi.actions.organisations.get(select))
}

export default publicPage(withOrgs(OrgListPage))
