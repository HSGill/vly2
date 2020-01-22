import { useState, useCallback } from 'react'
import { message } from 'antd'
import { useRouter } from 'next/router'
import PropTypes from 'prop-types'
import Loading from '../../components/Loading'
import OpTabs from '../../components/Op/OpTabs'
import {
  FullPage
} from '../../components/VTheme/VTheme'
import publicPage from '../../hocs/publicPage'
import reduxApi, { withMembers, withOps } from '../../lib/redux/reduxApi.js'
import { MemberStatus } from '../../server/api/member/member.constants'
import OpBanner from '../../components/Op/OpBanner'
import OpUnknown from '../../components/Op/OpUnknown'
import OpDetailForm from '../../components/Op/OpDetailForm'
import OpVolunteerInterestSection from '../../components/Op/OpVolunteerInterestSection'
import { Helmet } from 'react-helmet'

const blankOp = {
  name: '',
  subtitle: '',
  imgUrl: '/static/img/opportunity/opportunity.png',
  duration: '',
  location: 'Online',
  status: 'inactive',
  date: [],
  startDate: null,
  endDate: null,
  tags: []
}

export const OpDetailPage = ({
  members,
  me,
  opportunities,
  isNew,
  dispatch,
  isAuthenticated,
  actid,
  activities,
  tags,
  locations
}) => {
  const router = useRouter()
  const [tab, setTab] = useState(isNew ? 'edit' : router.query.tab)

  const updateTab = (key, top) => {
    setTab(key)
    if (top) window.scrollTo(0, 0)
    //  else { window.scrollTo(0, 400) }
    const newpath = `/ops/${op._id}?tab=${key}`
    router.replace(router.pathname, newpath, { shallow: true })
  }
  const handleTabChange = (key, e) => {
    updateTab(key, key === 'edit')
  }
  const handleCancel = useCallback(
    () => {
      updateTab('about', true)
      if (isNew) { // return to previous
        router.back()
      }
    },
    [isNew]
  )
  const handleSubmit = useCallback(
    async (op) => {
      let res = {}
      if (op._id) {
        // update existing op
        res = await dispatch(
          reduxApi.actions.opportunities.put(
            { id: op._id },
            { body: JSON.stringify(op) }
          )
        )
      } else {
        // save new opportunity
        res = await dispatch(
          reduxApi.actions.opportunities.post(
            {},
            { body: JSON.stringify(op) })
        )
        op = res[0] // get new id
        router.replace(`/ops/${op._id}`) // reload to the new id page
      }
      updateTab('about', true)
      message.success('Saved.')
    }, [])

  // bail early if no data
  if (opportunities.loading) {
    return <Loading />
  }
  const ops = opportunities.data
  if (ops.length === 0 && !isNew) {
    return <OpUnknown />
  }

  // setup the opportunity data
  let op
  if (isNew) {
    // new op
    op = blankOp

    // init from activity if provided
    if (actid) {
      const act = activities.data[0]
      op = {
        ...blankOp,
        name: act.name,
        subtitle: act.subtitle,
        description: act.description,
        imgUrl: act.imgUrl,
        duration: act.duration,
        tags: act.tags,
        fromActivity: actid
      }
    }
    op.requestor = me

    // set init offerOrg to first membership result
    if (
      me.orgMembership &&
     me.orgMembership.length > 0
    ) {
      op.offerOrg = {
        _id: me.orgMembership[0].organisation._id
      }
    }
  } else { // existing op
    op = {
      ...opportunities.data[0],
      startDate: opportunities.data[0].date[0],
      endDate: opportunities.data[0].date[1]
    }
  }
  // Who can edit?
  const isAdmin = me && me.role.includes('admin')
  const isOwner =
      isNew ||
      (me && op.requestor && me._id === op.requestor._id)

  let isOrgAdmin = false

  // add org membership to me so it can be used for offerOrg
  if (me && members.sync && members.data.length > 0) {
    me.orgMembership = members.data.filter(m =>
      [MemberStatus.MEMBER, MemberStatus.ORGADMIN].includes(m.status)
    )
    if (op.offerOrg) {
      isOrgAdmin = me.orgMembership.find(m => {
        return (m.status === MemberStatus.ORGADMIN &&
        m.organisation._id === op.offerOrg._id).length > 0
      })
    }
  }
  const canManage = isOwner || isAdmin || isOrgAdmin
  const canRegisterInterest = isAuthenticated && !isOwner

  if (tab === 'edit') {
    return (
      <FullPage>
        <Helmet>
          <title>Edit {op.name}  - Voluntarily</title>
        </Helmet>
        <OpDetailForm
          op={op}
          me={me}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          existingTags={tags.data}
          existingLocations={locations.data}
        />
      </FullPage>)
  }
  return (
    <FullPage>
      <Helmet>
        <title>{op.name} - Voluntarily</title>
      </Helmet>
      <OpBanner op={op}>
        <OpVolunteerInterestSection
          isAuthenticated={isAuthenticated}
          canRegisterInterest={canRegisterInterest}
          op={op}
          meID={me && me._id}
        />
      </OpBanner>
      <OpTabs op={op} canManage={canManage} defaultTab={tab} onChange={handleTabChange} />
    </FullPage>)
}

OpDetailPage.getInitialProps = async ({ store, query }) => {
  // console('getInitialProps: OpDetailPage', store, query)
  const me = store.getState().session.me
  // Get one Org
  const isNew = query && query.new && query.new === 'new'
  const opExists = !!(query && query.id) // !! converts to a boolean value
  await Promise.all([
    store.dispatch(reduxApi.actions.members.get({ meid: me._id })),
    store.dispatch(reduxApi.actions.locations.get()),
    store.dispatch(reduxApi.actions.tags.get())
  ])

  if (isNew) {
    // if there is an act parameter then get the activity and create initial op.
    if (query.act) {
      await store.dispatch(reduxApi.actions.activities.get({ id: query.act }))
    }
    return {
      isNew,
      actid: query.act
    }
  } else {
    if (opExists) {
      query.session = store.getState().session //  Inject session with query that restricted api access
      await store.dispatch(reduxApi.actions.opportunities.get(query))
    }
    return {
      isNew,
      opExists
    }
  }
}

OpDetailPage.propTypes = {
  op: PropTypes.shape({
    name: PropTypes.string.isRequired,
    subtitle: PropTypes.string,
    imgUrl: PropTypes.any,
    duration: PropTypes.string,
    location: PropTypes.string,
    _id: PropTypes.string.isRequired
  }),
  params: PropTypes.shape({
    id: PropTypes.string.isRequired
  })
}

export const OpDetailPageWithOps = withMembers(withOps(OpDetailPage))
export default publicPage(withMembers(withOps(OpDetailPage)))
