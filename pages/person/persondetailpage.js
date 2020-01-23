import { Button, message, Popconfirm } from 'antd'
import Cookie from 'js-cookie'
import Link from 'next/link'
import Router from 'next/router'
import PropTypes from 'prop-types'
import { Component } from 'react'
import { Helmet } from 'react-helmet'
import { FormattedMessage } from 'react-intl'
import Loading from '../../components/Loading'
import PersonDetail from '../../components/Person/PersonDetail'
import PersonDetailForm from '../../components/Person/PersonDetailForm'
import { IssueBadgeButton } from '../../components/IssueBadge/issueBadge'
import { FullPage } from '../../components/VTheme/VTheme'
import securePage from '../../hocs/securePage'
import reduxApi, { withMembers, withPeople, withLocations } from '../../lib/redux/reduxApi.js'
import { MemberStatus } from '../../server/api/member/member.constants'

const blankPerson = {
  // for new people load the default template doc.
  name: '',
  nickname: '',
  about: '',
  location: '',
  email: '',
  phone: '',
  pronoun: {
    subject: '',
    object: '',
    possessive: ''
  },
  imgUrl: '/static/img/person/person.png',
  website: null,
  facebook: null,
  twitter: null,
  role: ['volunteer'],
  status: 'inactive',
  tags: []
}

export class PersonDetailPage extends Component {
  state = {
    editing: false
  }

  static async getInitialProps ({ store, query, req }) {
    // Get one Org
    const isNew = query && query.new && query.new === 'new'
    await store.dispatch(reduxApi.actions.locations.get())
    await store.dispatch(reduxApi.actions.tags.get())
    if (isNew) {
      return {
        isNew: true,
        personid: null
      }
    } else if (query && query.id) {
      const meid = query.id
      const cookies = req ? req.cookies : Cookie.get()
      const cookiesStr = JSON.stringify(cookies)
      query.session = store.getState().session
      try {
        await store.dispatch(reduxApi.actions.people.get(query, {
          params: cookiesStr
        }))
        await store.dispatch(reduxApi.actions.members.get({ meid }))
      } catch (err) {
        // this can return a 403 forbidden if not signed in
        console.error('Error in persondetailpage:', err)
      }

      return {
        isNew: false,
        personid: query.id
      }
    }
  }

  componentDidMount () {
    if (this.props.isNew) {
      this.setState({ editing: true })
    }
  }

  handleCancelEdit = () => {
    if (this.props.isNew) { // return to previous
      return Router.back()
    }
    this.setState({ editing: false })
  }

  // TODO: [VP-209] only show person delete button for admins
  async handleDeletePerson (person) {
    await this.props.dispatch(reduxApi.actions.people.delete({ id: person._id }))
    // TODO error handling - how can this fail?
    message.success('Deleted. ')
    Router.replace('/people')
  }

  async handleSubmit (person) {
    // Actual data request
    let res = {}
    if (person._id) {
      res = await this.props.dispatch(reduxApi.actions.people.put({ id: person._id }, { body: JSON.stringify(person) }))
      this.setState({ editing: false })
    } else {
      res = await this.props.dispatch(reduxApi.actions.people.post({}, { body: JSON.stringify(person) }))
      person = res[0]
      Router.replace(`/people/${person._id}`)
    }
    message.success('Saved.')
  }

  handleCancelDelete = () => { message.error('Delete Cancelled') }

  render () {
    const isOrgAdmin = false // TODO: [VP-473] is this person an admin for the org that person belongs to.
    const isAdmin = (this.props.me && this.props.me.role.includes('admin'))
    const canRemove = isAdmin
    const showPeopleButton = isAdmin

    let content = ''
    let person = null
    if (this.props.people.loading) {
      content = <Loading />
    } else if (this.props.isNew) {
      person = blankPerson
    } else {
      const people = this.props.people.data
      if (people.length === 1) {
        person = people[0]
      }
    }
    const canEdit = (isOrgAdmin || isAdmin || (person && person._id === this.props.me._id))

    if (this.props.members.sync && this.props.members.data.length > 0) {
      person.orgMembership = this.props.members.data.filter(m => m.status === MemberStatus.MEMBER)
    }
    if (!this.props.people.loading) {
      if (!person) {
        content =
          <div>
            <h2><FormattedMessage id='person.notavailable' defaultMessage='Sorry, this person is not available' description='message on person not found page' /></h2>
            {showPeopleButton &&
              <Button shape='round'>
                <Link href='/people'>
                  <a>
                    <FormattedMessage id='showPeople' defaultMessage='Show All' description='Button to show all People' />
                  </a>
                </Link>
              </Button>}
            {isAdmin &&
              <>
                <Button shape='round'>
                  <Link href='/person/new'>
                    <a>
                      <FormattedMessage id='person.altnew' defaultMessage='New Person' description='Button to create a new person' />
                    </a>
                  </Link>
                </Button>
              </>}
          </div>
      } else {
        if (this.state.editing) {
          content = <PersonDetailForm person={person} onSubmit={this.handleSubmit.bind(this, person)} onCancel={this.handleCancelEdit.bind(this)} locations={this.props.locations.data} existingTags={this.props.tags.data} />
        } else {
          content =
            <>
              {canEdit &&
                <Button id='editPersonBtn' style={{ float: 'right' }} type='primary' shape='round' onClick={() => this.setState({ editing: true })}>
                  <FormattedMessage id='person.edit' defaultMessage='Edit' description='Button to edit a person' />
                </Button>}
              <PersonDetail person={person} />
            &nbsp;
              {canRemove &&
                <Popconfirm id='deletePersonConfirm' title='Confirm removal of this person.' onConfirm={this.handleDeletePerson.bind(this, person)} onCancel={this.handleCancelDelete.bind(this)} okText='Yes' cancelText='No'>
                  <Button id='deletePersonBtn' type='danger' shape='round'>
                    <FormattedMessage id='person.delete' defaultMessage='Remove Person' description='Button to remove an person on PersonDetails page' />
                  </Button>
                </Popconfirm>}
            &nbsp;
              {
                (isAdmin) && <IssueBadgeButton person={this.props.people.data[0]} />
              }
            </>
        }
      }
    }
    return (
      <FullPage>
        <Helmet>
          <title>Person Details - Voluntarily</title>
        </Helmet>
        {content}
      </FullPage>
    )
  }
}

PersonDetailPage.propTypes = {
  person: PropTypes.shape({
    _id: PropTypes.string,
    name: PropTypes.string,
    nickname: PropTypes.string,
    about: PropTypes.string,
    location: PropTypes.string,
    email: PropTypes.string,
    phone: PropTypes.string,
    pronoun: PropTypes.object,
    imgUrl: PropTypes.any,
    role: PropTypes.arrayOf(PropTypes.oneOf(['admin', 'opportunityProvider', 'volunteer', 'activityProvider', 'tester'])),
    status: PropTypes.oneOf(['active', 'inactive', 'hold']),
    tags: PropTypes.arrayOf(PropTypes.string)
  }),
  params: PropTypes.shape({
    id: PropTypes.string.isRequired
  })
}

export default securePage(withMembers(withPeople(withLocations(PersonDetailPage))))
